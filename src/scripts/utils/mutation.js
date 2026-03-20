import { necromancePosts } from './necromancy.js';

class MutationManager {
  addedNodesQueue = [];
  targetNodesQueue = [];
  updateQueued = false;
  timerId;
  root;
  listeners = new Map();

  #funcManager(testNodes) {
    for (const [func, selector] of this.listeners) {
      if (func.length === 0) {
        const shouldRun = testNodes.some(testNode => testNode.matches(selector) || testNode.querySelector(selector) !== null);
        if (shouldRun) {
          try {
            func();
          } catch (e) {
            console.error(e);
          }
        }
        continue;
      }

      const matchingElements = [
        ...testNodes.filter(testNode => testNode.matches(selector)),
        ...testNodes.flatMap(testNode => [...testNode.querySelectorAll(selector)])
      ].filter((value, index, array) => index === array.indexOf(value));

      if (matchingElements.length !== 0) {
        try {
          func(matchingElements);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  #nodeManager() {
    this.updateQueued = false;

    const addedNodes = this.addedNodesQueue
      .splice(0)
      .filter(addedNode => addedNode.isConnected);

    if (addedNodes.length > 0) this.#funcManager(addedNodes);
  };

  /**
   * Start a mutation callback
   * @param {string} selector - CSS selector for elements to target
   * @param {Function} func - Callback function for matching elements
   */
  start(selector, func) {
    if (this.listeners.has(func)) this.listeners.delete(func);
    this.listeners.set(func, selector);
    this.trigger(func);
  }

  /**
   * Stop a mutation callback
   * @param {Function} func - Function to remove
   */
  stop(func) {
    if (this.listeners.has(func)) this.listeners.delete(func);
    if (this.targetListeners.has(func)) this.listeners.delete(func);
  }

  /**
   * Trigger a mutation callback on all matching elements
   * @param {Function} func - Function to run
   */
  trigger(func) {
    let selector;
    if (this.listeners.has(func)) selector = this.listeners.get(func);
    else if (this.targetListeners.has(func)) selector = this.targetListeners.get(func);
    else return;

    if (func.length === 0) {
      const shouldRun = this.root.querySelector(selector) !== null;
      if (shouldRun) func();
      return;
    }

    const matchingElements = [...this.root.querySelectorAll(selector)];
    if (matchingElements.length !== 0) {
      func(matchingElements);
    }
  }

  /**
   * Disconnects and deletes the mutation manager
   */
  disconnect() {
    this.observer.disconnect();
    delete this;
  }

  constructor(root) {
    this.root = root || document.body || document.documentElement;// fallback for some early loads
    this.observer = new MutationObserver(mutations => {
      const addedNodes = mutations
        .flatMap(({ addedNodes }) => [...addedNodes])
        .filter(addedNode => addedNode instanceof Element);

      this.addedNodesQueue.push(...addedNodes);

      requestAnimationFrame(this.#nodeManager.bind(this)); // JS is the best OOP ever

      if (this.updateQueued === false) {
        this.timerId = requestAnimationFrame(this.#nodeManager.bind(this));
        this.updateQueued = true;
      }
    });

    this.observer.observe(this.root, { childList: true, subtree: true });

    console.log(this.observer)
  }
}

export const mutationManager = new MutationManager();

export class ShadowManager extends MutationManager {
  constructor(shadowHost) {
    super(shadowHost.shadowRoot);
  }
}

const postSelector = 'article[data-post-id]';
const bookHostId = 'book-shadow-host';
let pfShadowManager;

const onNewPosts = posts => {
  for (const [func, filter] of postFunction.functions) {
    filter ? func(posts.filter(post => post.matches(filter))) : func(posts)
  }
  necromancePosts(posts);
}

export const postFunction = Object.freeze({ // old PF interface but with a new coat of...shadow DOM paint
  functions: new Map(),

  /**
   * Start a mutation callback on new posts
   * @param {string} selector - CSS selector for elements to target
   * @param {Function} func - Callback function for matching elements
   */
  start(func, filter = false) {
    if (this.functions.has(func)) this.functions.delete(func);
    this.functions.set(func, filter);
    if (!pfShadowManager) { // book pages encapsulate the whole post container in the shadow DOM, thus we need a ShadowManager to look for book page posts
      const host = document.getElementById(bookHostId);
      if (host) pfShadowManager = new ShadowManager(host);
    }
    if (pfShadowManager) {
      if (pfShadowManager.listeners.has(onNewPosts)) pfShadowManager.trigger(onNewPosts);
      else (pfShadowManager.start(postSelector, onNewPosts));
    }
    if (mutationManager.listeners.has(onNewPosts)) mutationManager.trigger(onNewPosts);
    else (mutationManager.start(postSelector, onNewPosts));
  },

  /**
   * Stop a mutation callback
   * @param {Function} func - Function to remove
   */
  stop(func) {
    this.functions.delete(func);
    pfShadowManager?.stop(func);
    mutationManager.stop(func)
  }
});