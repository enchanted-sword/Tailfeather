import { mutationManager } from './utils/mutation.js';

const customAttribute = 'data-tf-auto-readmore';
const readmoreSelector = `.post-body-collapsed + .post-read-more:not([${customAttribute}])`;

const readMores = buttons => buttons.forEach(button => {
  button.click();
  button.setAttribute(customAttribute, '');
});

export const main = async () => mutationManager.start(readmoreSelector, readMores);

export const clean = async () => mutationManager.stop(readMores);