const customClass = 'tailfeather-emojifix';

export const main = async () => document.documentElement.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', className: customClass, href: 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap' }));
export const clean = async () => document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());