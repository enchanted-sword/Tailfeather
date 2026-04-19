const calcWidth = () => Math.min(320, window.innerWidth - 16);

function positionDropdown({ target }) {
  const dropdown = document.getElementById('notif-dropdown');
  const { bottom } = target.closest('.notif-bell-wrap').getBoundingClientRect();
  dropdown.style.top = bottom - 24 + 'px';
}

export const main = async () => document.getElementById('notif-bell').addEventListener('click', positionDropdown);
export const clean = async () => document.getElementById('notif-bell')?.removeEventListener('click', positionDropdown);