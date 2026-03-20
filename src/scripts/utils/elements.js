import { noact } from './noact.js';

const playIcon = () => noact({
  fill: 'none',
  viewBox: '0 0 24 24',
  'stroke-width': 1.5,
  stroke: 'currentColor',
  'aria-hidden': true,
  className: 'm-auto h-9 w-9',
  children: [
    {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z'
    }
  ]
});
const pauseIcon = () => noact({
  fill: 'none',
  viewBox: '0 0 24 24',
  'stroke-width': 1.5,
  stroke: 'currentColor',
  'aria-hidden': true,
  className: 'm-auto h-9 w-9',
  children: [
    {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ]
});
const volumeIcon = id => noact({
  id,
  className: 'h-6 w-6 volume-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  'stroke-width': 1.5,
  stroke: 'currentColor',
  dataset: { muted: '', volume: 3 },
  children: [
    {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'm 8.01296,8.89281 c 0,0 -1.21949,2.90009 0,6.21439 M 12.1382,4.74989 8.01558,8.89281 H 4.2434 c -0.55164,0 -0.9934,0.4345 -0.9934,0.9737 v 4.26699 c 0,0.5392 0.44176,0.9737 0.9934,0.9737 h 3.77218 l 4.12262,4.1429 z'
    },
    {
      className: 'volume-1',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'm 14.096542,10.165673 c 0.826195,0.221388 1.400713,0.970094 1.400665,1.825377 3.4e-5,0.855341 -0.57447,1.604011 -1.400642,1.825384'
    },
    {
      className: 'volume-2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'm 15.350183,8.3377038 c 1.652392,0.4427716 2.801345,1.9401262 2.801331,3.6507512 -1.8e-5,1.710632 -1.148936,3.208015 -2.80128,3.65076'
    },
    {
      className: 'volume-3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'm 16.739362,6.5123739 c 2.478504,0.6641052 4.201889,2.9101157 4.20191,5.4760801 2e-5,2.565964 -1.723406,4.812026 -4.201923,5.476143'
    },
    {
      className: 'volume-mute',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'M 20.2627,9.25394 C 14.1744,15.3422 14.2036,15.313 14.2036,15.313 m 0,-6.05906 c 6.0883,6.08826 6.0591,6.05906 6.0591,6.05906'
    },
  ]
});
export const audioPlayer = (src, preloadDuration = false, track = '', artist = 'unknown artist') => {
  let playstate;
  let frameId;

  const identifier = src.split('/').pop();
  !track && (track = identifier);
  const audio = noact({
    tag: 'audio',
    src,
    preload: 'metadata',
    className: 'w-full p-2',
    dataset: { testid: 'audio' },
    tabindex: -1,
    children: [{
      href: src,
      tabindex: -1,
      children: ['download audio']
    }],
  });
  const formatDuration = duration => {
    const ss = String(duration % 60).padStart(2, '0');
    const mm = String(Math.floor(duration / 60)).padStart(2, '0');
    const hh = duration >= 3600 ? String(Math.floor(duration / 3600)).padStart(2, '0') : null;
    return [hh, mm, ss].filter(t => t !== null).join(':');
  };
  const showDuration = () => {
    const { duration } = audio;
    const durationString = formatDuration(Math.floor(duration));

    document.getElementById(`${identifier}-range`).max = duration;
    document.getElementById(`${identifier}-end`).innerText = durationString;
  };
  const togglePlayState = function () {
    if (playstate) {
      audio.pause();
      playstate = 0;
      document.getElementById(`${identifier}-playbutton`).replaceChildren(playIcon());
      cancelAnimationFrame(frameId);
    } else {
      audio.play();
      playstate = 1;
      document.getElementById(`${identifier}-playbutton`).replaceChildren(pauseIcon());
      frameId = requestAnimationFrame(playback);
    }
  };
  const seekInput = function ({ target: { value } }) {
    document.getElementById(`${identifier}-start`).innerText = formatDuration(Math.floor(value));
    !audio.paused && (cancelAnimationFrame(frameId));
  };
  const seekChange = function ({ target: { value } }) {
    audio.currentTime = value;
    !audio.paused && (requestAnimationFrame(playback));
  };
  const playback = () => {
    document.getElementById(`${identifier}-start`).innerText = formatDuration(Math.floor(audio.currentTime));
    document.getElementById(`${identifier}-range`).value = audio.currentTime;
    if (audio.ended) {
      togglePlayState();
      return;
    } else frameId = requestAnimationFrame(playback);
  };

  if (!preloadDuration) {
    if (audio.readyState > 0) showDuration();
    else audio.addEventListener('loadedmetadata', showDuration);
  }

  return noact({
    tag: 'figure',
    className: 'group relative w-full flex-initial',
    children: [
      {
        id: `${identifier}-caption`,
        tag: 'figcaption',
        className: 'sr-only',
        children: [`${artist} - ${track}`]
      },
      audio,
      {
        className: 'flex flex-row',
        children: [
          {
            id: `${identifier}-playbutton`,
            type: 'button',
            onclick: togglePlayState,
            className: 'w-[76px] bg-cherry flex-shrink-0 flex-grow',
            title: 'play',
            tabindex: 0,
            children: [playIcon()]
          },
          {
            className: 'flex w-full flex-col bg-notBlack p-2',
            children: [
              {
                className: 'flex flex-row gap-4',
                children: [
                  {
                    id: `${identifier}-track`,
                    className: 'flex-1',
                    children: [track]
                  },
                  {
                    className: 'relative',
                    children: [
                      {
                        id: `${identifier}-volState`,
                        className: 'volume-state cursor-pointer',
                        dataset: { state: '' },
                        onclick: function () {
                          this.dataset.state ? this.dataset.state = '' : this.dataset.state = 'open';
                        },
                        children: volumeIcon(`${identifier}-volDisplay`)
                      },
                      {
                        className: 'volume-controls absolute top-0 bg-cherry rounded-lg right-0 h-10 w-52 p-1 justify-between items-center',
                        onmouseout: function () {
                          setTimeout(() => {
                            !(this.matches(':hover')) && (document.getElementById(`${identifier}-volState`).dataset.state = "");
                          }, 150)
                        },
                        children: [
                          {
                            className: 'cursor-pointer',
                            onclick: function () {
                              if (audio.muted) {
                                document.getElementById(`${identifier}-volDisplay`).dataset.muted = '';
                                document.getElementById(`${identifier}-volControl`).dataset.muted = '';
                                audio.muted = false;
                              } else {
                                document.getElementById(`${identifier}-volDisplay`).dataset.muted = 'muted';
                                document.getElementById(`${identifier}-volControl`).dataset.muted = 'muted';
                                audio.muted = true;
                              }
                            },
                            children: volumeIcon(`${identifier}-volControl`),
                          },
                          {
                            id: `${identifier}-volInput`,
                            className: 'audio-controls mx-1 flex-1 accent-mango w-36',
                            tag: 'input',
                            type: 'range',
                            min: 0,
                            max: 1,
                            step: 'any',
                            value: audio.volume,
                            oninput: function ({ target: { value } }) {
                              audio.volume = value;
                              document.getElementById(`${identifier}-volOutput`).innerText = String(Math.floor(value * 100)).padStart(2, '0');
                              const level = Math.min(Math.floor(value * 4), 3);
                              document.getElementById(`${identifier}-volDisplay`).dataset.volume = level;
                              document.getElementById(`${identifier}-volControl`).dataset.volume = level;
                            }
                          },
                          {
                            id: `${identifier}-volOutput`,
                            className: 'text-xs tabular-nums w-6',
                            style: 'text-align:end',
                            tag: 'output',
                            children: String(Math.floor(audio.volume * 100)).padStart(2, '0')
                          }
                        ]
                      }
                    ]
                  },
                  {
                    href: src,
                    download: '',
                    title: 'download',
                    tabindex: 0,
                    children: [{
                      fill: 'none',
                      viewBox: '0 0 24 24',
                      'stroke-width': 1.5,
                      stroke: 'currentColor',
                      'aria-hidden': true,
                      className: 'm-auto h-6 w-6',
                      children: [
                        {
                          'stroke-linecap': 'round',
                          'stroke-linejoin': 'round',
                          d: 'M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z'
                        }
                      ]
                    }]
                  }
                ]
              },
              {
                id: `${identifier}-artist`,
                className: 'text-xs',
                children: [artist]
              },
              {
                className: 'flex flex-row items-center',
                children: [
                  {
                    tag: 'div',
                    id: `${identifier}-start`,
                    className: 'text-xs tabular-nums',
                    children: ['00:00']
                  },
                  {
                    id: `${identifier}-range`,
                    tag: 'input',
                    type: 'range',
                    className: 'audio-controls mx-1 flex-1 accent-mango',
                    min: 0,
                    max: preloadDuration ? preloadDuration : 1,
                    step: 'any',
                    value: 0,
                    oninput: seekInput,
                    onchange: seekChange,
                    tabindex: 0
                  },
                  {
                    tag: 'div',
                    id: `${identifier}-end`,
                    className: 'text-xs tabular-nums',
                    children: [preloadDuration ? formatDuration(Math.floor(preloadDuration)) : '00:00']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });
};

export const headerIconContainer = () => noact({
  className: 'ch-utils-headerIconContainer flex-1 flex items-center justify-end gap-3'
});

const infoBox = (type, text) => noact({
  className: 'flex flex-col items-center m-3 gap-3',
  children: [{
    className: `co-info-box co-${type} box-border border-[1px] flex flex-row items-center gap-3 self-stretch rounded-lg p-3`,
    children: [
      {
        className: 'h-6 w-6 flex-none',
        fill: 'none',
        'stroke-width': 1.5,
        stroke: 'currentColor',
        viewBox: '0 0 24 24',
        'aria-hidden': true,
        children: [{
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
        }]
      },
      { children: text }
    ]
  }]
});
const adultToggle = () => noact({
  className: 'ch-utils-18-plus flex flex-col items-center m-3 gap-3',
  children: [
    {
      className: `ch-utils-18-plus-info co-info-box co-18-plus box-border border-[1px] flex flex-row items-center gap-3 self-stretch rounded-lg p-3`,
      children: [
        {
          className: 'h-6 w-6 flex-none',
          fill: 'none',
          'stroke-width': 1.5,
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          'aria-hidden': true,
          children: [{
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            d: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
          }]
        },
        {
          children: [
            'This post contains 18+ content.',
            displayPrefs.explicitlyCollapseAdultContent ? ' We\'re hiding it according to your content preferences.' : null
          ]
        }
      ]
    },
    {
      className: 'ch-utils-18-plus-toggle flex flex-row items-center gap-3',
      children: [
        {
          href: 'https://help.antisoftware.club/a/solutions/articles/62000225024',
          className: 'co-info-box co-18-plus border-[1px] hover-underline flex h-10 items-center justify-center self-center rounded-lg bg-foreground py-2 px-3 leading-none hidden',
          target: '_blank',
          rel: 'noreferrer',
          children: '18+'
        },
        {
          className: 'ch-utils-18-plus-button co-filled-button tracking-wider whitespace-nowrap flex h-10 items-center justify-center self-center rounded-lg bg-foreground py-2 px-3 leading-none',
          onclick: function () {
            if (this.dataset.state) {
              this.dataset.state = '';
              this.textContent = 'show post';
            }
            else {
              this.dataset.state = 'open';
              this.textContent = 'hide post';
            }
          },
          dataset: { state: displayPrefs.explicitlyCollapseAdultContent ? '' : 'open' },
          children: displayPrefs.explicitlyCollapseAdultContent ? 'show post' : 'hide post'
        }
      ]
    }
  ]
});
const cwToggle = (adult, cws) => noact({
  className: 'ch-utils-18-plus ch-utils-cw flex flex-col items-center m-3 gap-3',
  children: [
    adult ? {
      className: `ch-utils-18-plus-info co-info-box co-18-plus box-border border-[1px] flex flex-row items-center gap-3 self-stretch rounded-lg p-3`,
      children: [
        {
          className: 'h-6 w-6 flex-none',
          fill: 'none',
          'stroke-width': 1.5,
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          'aria-hidden': true,
          children: [{
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            d: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
          }]
        },
        {
          children: [
            'This post contains 18+ content.',
            displayPrefs.explicitlyCollapseAdultContent ? ' We\'re hiding it according to your content preferences.' : null
          ]
        }
      ]
    } : null,
    {
      className: `ch-utils-cw-info co-info-box co-warning box-border border-[1px] flex flex-row items-center gap-3 self-stretch rounded-lg p-3`,
      children: [
        {
          className: 'h-6 w-6 flex-none',
          fill: 'none',
          'stroke-width': 1.5,
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          'aria-hidden': true,
          children: [{
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            d: 'M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z'
          }]
        },
        {
          children: [
            {
              className: 'ch-utils-cw-infoLine',
              children: [
                'This post has content warnings for:',
                ...cws.map(cw => ({ tag: 'span', className: 'font-bold', children: ` ${cw}` })),
                { tag: 'span', className: 'font-bold', children: '.' }
              ]
            },
            {
              className: 'ch-utils-cw-openLine hidden',
              children: [
                adult ? [
                  'This post contains ',
                  {
                    href: 'https://help.antisoftware.club/a/solutions/articles/62000225024',
                    className: 'underline',
                    target: '_blank',
                    rel: 'noreferrer',
                    children: '18+ content'
                  },
                  '.',
                  { tag: 'br' },
                ] : null,
                'CWs:',
                ...cws.map(cw => ({ tag: 'span', className: 'font-bold', children: ` ${cw}` })),
                { tag: 'span', className: 'font-bold', children: '.' }
              ]
            }
          ]
        }
      ]
    },
    {
      className: 'ch-utils-18-plus-button co-filled-button tracking-wider whitespace-nowrap flex h-10 items-center justify-center self-center rounded-lg bg-foreground py-2 px-3 leading-none',
      onclick: function () {
        if (this.dataset.state) {
          this.dataset.state = '';
          this.textContent = 'show post';
        }
        else {
          this.dataset.state = 'open';
          this.textContent = 'hide post';
        }
      },
      dataset: { state: displayPrefs.explicitlyCollapseAdultContent ? '' : 'open' },
      children: displayPrefs.explicitlyCollapseAdultContent ? 'show post' : 'hide post'
    }
  ]
});

const meatballMenuButton = postId => noact({
  id: `mb-${postId}`,
  style: 'order: 2',
  onclick: function () {
    function closeMenu(event) {
      event.stopPropagation();
      if (!event.target.closest('[id*="mb"]') && !event.target.closest('.ch-utils-mb')) {
        document.querySelectorAll('[id*="mb"][data-headlessui-state="open"]').forEach(button => button.click());
      }
    }
    if (this.dataset.headlessuiState) {
      this.dataset.headlessuiState = '',
        this.setAttribute('aria-expanded', false);
      document.documentElement.removeEventListener('click', closeMenu);
    } else {
      this.dataset.headlessuiState = 'open',
        this.setAttribute('aria-expanded', true);
      document.documentElement.addEventListener('click', closeMenu);
    }
  },
  type: 'button',
  'aria-haspopup': 'menu',
  'aria-expanded': false,
  dataset: { headlessuiState: '' },
  children: [{
    className: 'co-action-button h-6 w-6 transition-transform ui-open:rotate-90',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.5,
    'aria-hidden': true,
    children: [{
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: 'M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'
    }]
  }]
});
const meatballMenu = post => noact({
  style: 'top: 2.75rem; right: .75rem',
  className: 'hidden ch-utils-mb absolute cohost-shadow-dark z-30 flex min-w-max flex-col gap-3 rounded-lg bg-notWhite p-3 text-notBlack focus:!outline-none',
  'aria-labelledBy': `mb-${post.postId}`,
  role: 'menu',
  tabindex: 0,
  children: [
    {
      onclick: function () { navigator.share({ url: post.singlePostPageUrl }) },
      className: 'flex flex-row gap-2 hover:underline',
      role: 'menuitem',
      tabindex: -1,
      children: [
        {
          viewBox: '0 0 24 24',
          className: 'h-6',
          children: [{
            d: 'M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z'
          }]
        },
        'share post'
      ]
    },
    {
      onclick: function () {
        const post = this.closest('article');
        let theme = post.dataset.theme;

        if (theme === 'light' || (theme === 'both' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)) {
          theme = 'dark';
        } else theme = 'light';

        post.dataset.theme = theme;
      },
      className: 'flex flex-row gap-2 hover:underline',
      role: 'menuitem',
      tabindex: -1,
      children: [
        {
          viewBox: '0 0 24 24',
          className: 'h-6',
          children: [{
            d: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'
          }]
        },
        'invert colors'
      ]
    }
  ]
});

const formatMarkdown = markdown => noact({
  className: 'co-prose prose my-4 overflow-hidden break-words px-3',
  innerHTML: displayPrefs.disableEmbeds ? parseMd(markdown) : parseMdEmbed(markdown)
});
const formatImage = attachment => noact({
  tag: 'button',
  className: 'group relative w-full flex-initial',
  tabindex: 0,
  children: [{
    src: attachment.fileURL,
    className: 'h-full w-full object-cover',
    alt: attachment.altText,
    dataset: { attachmentId: attachment.attachmentId }
  }]
});
const formatTags = post => noact({
  className: 'w-full max-w-full p-3',
  children: [{
    className: 'co-tags relative w-full overflow-y-hidden break-words leading-none ',
    children: [{
      children: post.tags.map(tag => ({ href: `/rc/tagged/${encodeURIComponent(tag)}`, className: 'mr-2 inline-block text-sm', children: ['#', tag] }))
    }]
  }]
});

const mapBlocks = blocks => {
  let sortedBlockIndex = 0;
  const sortedBlocks = [];
  blocks.map((block, index) => {
    if (block.attachment?.kind === 'image') {
      sortedBlocks[sortedBlockIndex] ?? sortedBlocks.push([]);
      sortedBlocks[sortedBlockIndex].push(block);
      if (blocks[index + 1]?.attachment?.kind !== 'image') ++sortedBlockIndex;
    } else sortedBlocks.push(block);
  });
  return sortedBlocks.map(block => {
    if (Array.isArray(block)) {
      const rows = [];
      block.map((img, i) => {
        if (block.length === 3 && i === 2) rows[0].children.push(formatImage(img.attachment));
        else if (i % 2 === 0) rows[i / 2] = {
          className: 'flex w-full flex-nowrap content-start justify-between',
          dataset: { testid: `row-${i / 2}` },
          children: [formatImage(img.attachment)]
        }; else rows[(i - 1) / 2].children.push(formatImage(img.attachment))
      });
      return rows;
    } else if (block.type === 'markdown') return formatMarkdown(block.markdown.content);
    else if (block.attachment?.kind === 'audio') return audioPlayer(block.attachment.fileURL, false, block.attachment.title, block.attachment.artist || 'unknown artist');
    else if (block.type === 'ask') return embeddedAsk(block.ask);
    else return '';
  });
};

const formatPosts = (parentPost, tree) => {
  return tree.map((post, index) => noact({
    children: [
      {
        id: `post-${post.postId}`,
        className: 'relative -top-20',
        dataset: { testid: `post-${post.postId}` }
      },
      parentPost.shareOfPostId ? postHeader(post) : null,
      {
        children: [{
          children: [
            post.state === 0 ? infoBox('info', 'This post is a draft.  It\'s not publicly visible, but you can send people links to it.') : null,
            post.state === 2 ? infoBox('tombstone', 'Sorry!  This post has been deleted by its original author.') : null,
            (post.state !== 2 && post.cws.length === 0 && post.effectiveAdultContent) ? adultToggle() : null,
            post.cws.length ? cwToggle(post.effectiveAdultContent, post.cws) : null,
            post.headline ? postHeadline(post) : null,
            {
              className: 'relative overflow-hidden supports-[overflow:clip]:overflow-clip isolate co-contain-paint',
              dataset: { testid: 'post-body', postBody: true },
              children: mapBlocks(post.blocks)
            }
          ]
        }]
      },
      post.tags.length ? formatTags(post) : null,
      index < tree.length - 1 ? { tag: 'hr', className: 'co-hairline' } : null,
    ]
  }));
};

export const renderPost = post => {
  const prevShare = post.shareTree.find(share => share.postId === post.shareOfPostId);
  const tree = post.shareTree.filter(post => !post.transparentShareOfPostId);
  if (!post.transparentShareOfPostId) tree.push(post);

  const thread = noact({
    className: 'ch-utils-customPost renderIfVisible',
    children: [{
      className: 'grid  w-full gap-x-6 gap-y-2',
      dataset: { testid: `post-${post.postId} `, postid: post.postId },
      children: [
        {
          tag: 'article',
          className: 'co-themed-box co-post-box',
          dataset: { theme: postBoxTheme },
          children: [
            threadHeader(post, prevShare),
            { tag: 'hr', className: 'co-hairline' },
            formatPosts(post, tree),
            post.tags.length && post.transparentShareOfPostId ? threadPreFooter(post) : null,
            { tag: 'hr', className: 'co-hairline' },
            threadFooter(post)
          ]
        }
      ]
    }]
  });
  return thread;
};