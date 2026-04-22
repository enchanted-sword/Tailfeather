import { activeSlug } from './activeBlogs.js';

const getCSRFToken = () => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith('csrftoken=')) {
      return trimmed.substring('csrftoken='.length);
    }
  }
  return '';
}

const defaultOptions = {
  baseUrl: 'https://noterook.net/api',
  method: 'GET',
  credentials: 'include',
  headers: {
    Accept: '*/*',
    'X-Version': 'Tailfeather',
    'X-CSRFToken': getCSRFToken()
  },
  queryParams: {},
};

const jsonTypes = ['application/octet-stream', 'application/json'];

const convertToFetchOptions = options => {
  // These are not actually options passed to native fetch api
  // eslint-disable-next-line no-unused-vars
  const { baseUrl, queryParams, ...optionsWithoutExtraData } = options;

  return optionsWithoutExtraData;
};
const filterProperties = (object, filterFunction, mapFunction) => {
  const filteredEntries = Object.entries(object).filter(([key, value]) => filterFunction(key, value));

  return Object.fromEntries(
    mapFunction ? filteredEntries.map(mapFunction) : filteredEntries
  );
};
const addQueryParams = (path, queryParams) => join(path, printQueryParams(path, queryParams,));
const join = (path, queryParams) => {
  if (!queryParams) {
    return path;
  }

  const joiner = path.indexOf('?') >= 0 ? '&' : '?';

  return `${path}${joiner}${queryParams}`;
};
const isPlainObject = value => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Object.getPrototypeOf(value) === null) {
    return true;
  }

  return Object.prototype.isPrototypeOf.call(Object.getPrototypeOf(value), Object);
}

/**
 * Prints an input object as a URL query string segment (without leading "?")
 *
 * Assuming here we have a nested query arg that should be
 * flattened when sending over the wire. Objects with depth
 * greater than one level are undefined and we will skip them.
 *
 * This function looks bloated because of the repetition inside
 * the iteration of `givenParams` but because we only allow flattening
 * of objects that are one level deep this function is left concrete
 * to handle those two levels: top level; and nested once. In other
 * words, this is not a recursive function _by design_.
 *
 * E.g. {fields: {body: 'blah'}} -> {'fields[body]': 'blah'}
 */
const printQueryParams = (path, givenParams) => {
  const queryParams = [];

  if (!givenParams) {
    return '';
  }

  if (!isPlainObject(givenParams)) {
    return '';
  }

  const pathKeys = new Set(path.split('?')[1]?.split('&').map(param => param.split('=')[0]) || []);

  for (const [key, value] of Object.entries(givenParams)) {
    if (!key || value === undefined || pathKeys.has(key)) {
      continue;
    }

    const printable = printableValue(value);
    if (printable) {
      queryParams.push([encodeURIComponent(key), encodeURIComponent(printable)]);
      continue;
    }

    if (!isPlainObject(value)) {
      continue;
    }

    for (const [innerKey, innerValue] of Object.entries(value)) {
      if (!innerKey || innerValue === undefined) {
        continue;
      }

      const innerPrintable = printableValue(innerValue);
      if (null === innerPrintable) {
        // ignore this, deeply-nested parameters are unsupported.
        // @TODO: should we leave a console warning?
        continue;
      }

      const compoundKey = `${encodeURIComponent(key)}[${encodeURIComponent(innerKey)}]`;
      queryParams.push([compoundKey, encodeURIComponent(innerPrintable)]);
    }
  }

  return queryParams.map(([key, value]) => `${key}=${value}`).join('&');
};
const printableValue = value => {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return `${value}`;
    default:
      return null;
  }
};

/**
 * Fetches data via the Noterook API
 * @param {...any} args - Arguments to pass to the API call
 * @returns {Promise<Response|Error>} Resolves or rejects with result of the API call
 */
export async function apiFetch(givenPath, givenOptions) {
  // Note: we apply the `givenOptions` headers and queryParams twice to tweak
  // the ordering. Applying them the first time ensures that the given entries appear
  // first, and applying them the second time sets any properties back to their
  // correct value in case they've been overriden by `defaultOptions`.
  const options = {
    ...defaultOptions,
    ...givenOptions,
    headers: {
      ...givenOptions?.headers,
      ...defaultOptions.headers,
      ...givenOptions?.headers,
    },
    queryParams: {
      ...givenOptions?.queryParams,
      ...defaultOptions.queryParams,
      ...givenOptions?.queryParams,
    },
  };

  // Let function calls override active blog so we can post from different blogs and have the SSE resolve the author correctly
  // Only stamp for same-origin relative URLs so we don't leak active-blog identity to third parties.
  if (!('X-As-Blog' in options.headers) && options.baseUrl === defaultOptions.baseUrl) options.headers['X-As-Blog'] = activeSlug;
  console.log(options, activeSlug)

  if (options.body) {
    const contentType = options.headers['Content-Type'];

    // FormData should never be stringified
    if (contentType !== 'multipart/form-data') {
      // strip undefined values from the body if it is an object
      if (typeof options.body === 'object') {
        options.body = filterProperties(options.body, (_key, value) => value !== undefined);
      }
      options.body = JSON.stringify(options.body);
    }

    /**
     * In order to send stuff via multipart/form-data we need a boundary,
     * the best way to generate this is to just let the browser do it for you.
     * So when you upload a FormData instance with enctype `multipart/form-data` the
     * browser will automatically get what you're trying to do and calculate the boundary for you.
     * Hence why we just delete the header here
     */
    if (contentType === 'multipart/form-data') {
      delete options.headers['Content-Type'];
    } else if (!contentType) {
      options.headers['Content-Type'] = 'application/json; charset=utf8';
    }
  }

  const path = addQueryParams(
    givenPath,
    filterProperties(options.queryParams, (_key, value) => value !== undefined),
  );

  const requestUrl = `${options.baseUrl}${path}`;

  const fetchOptions = convertToFetchOptions(options);
  let fetchPromise = fetch(requestUrl, fetchOptions)
    .then(async response => {
      if (jsonTypes.includes(response.headers.get('content-type'))) return response.json().catch(error => { throw new Error('JsonError:', requestUrl, fetchOptions, error) });
      else return response;
    }, error => {
      // Catching an error at this stage means it can only be a network error
      throw new Error('NetworkError:', requestUrl, fetchOptions, error);
    });

  return fetchPromise;
}

const apiCache = new Map();
const timeoutCache = new Map();

const timedOut = (key, timeout) => {
  const t0 = timeoutCache.get(key);
  if (t0) return (Date.now() - t0) > timeout;
  return false;
}

export async function apiFetchCache(givenPath, givenOptions, timeout = 300000) {
  const key = JSON.stringify(Object.assign(structuredClone(givenOptions || {}), { givenPath }));

  if (!apiCache.has(key) || timedOut(key, timeout)) {
    apiCache.set(key, apiFetch(givenPath, givenOptions));
    timeoutCache.set(key, Date.now());
  }

  return apiCache.get(key);
}