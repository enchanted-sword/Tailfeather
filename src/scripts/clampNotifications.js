const calcWidth = () => Math.min(320, window.innerWidth - 16);

function clampDropdown({ target }) {
  const dropdown = document.getElementById('notif-dropdown');
  const { right } = target.closest('.notif-bell-wrap').getBoundingClientRect();
  const leftEdge = right - calcWidth() - 8;
  if (leftEdge < 0) {
    dropdown.style.right = leftEdge - 8 + 'px';
  } else dropdown.style.right = 0;
}

export const main = async () => document.getElementById('notif-bell').addEventListener('click', clampDropdown);
export const clean = async () => document.getElementById('notif-bell')?.removeEventListener('click', clampDropdown);