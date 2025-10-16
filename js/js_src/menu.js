function menuToggleClick(id) {
  // clicking needed to include bootstrap
  const menuHeader = document.getElementById(`menu-header-${id}`);
  menuHeader.click();
}
function menuToggleExtra(id) {
  // non-bootstrap opening
  const header = document.getElementById(`menu-header-${id}`);
  const body = document.getElementById(`menu-content-${id}`);

  if (menuIsOpen(id)) {
    body.classList.remove('body-open');
    header.classList.remove('header-open');
  } else {
    body.classList.add('body-open');
    header.classList.add('header-open');
  }
  // icon.className = isVisible ? 'bi bi-caret-right-fill' : 'bi bi-caret-down-fill';
}

async function openMenu(id) {
  if (menuIsOpen(id)) {
    return;
  }

  menuToggleClick(id);
}

async function closeMenu(id) {
  if (!menuIsOpen(id)) {
    return;
  }

  menuToggleClick(id);
}

function menuIsOpen(id) {
  return document
    .getElementById(`menu-header-${id}`)
    .classList.contains('header-open');
}

function toggleCheckbox(parentEl) {
  const checkbox = parentEl.querySelector('input[type="checkbox"]');
  parentEl.classList.toggle('selected', checkbox.checked);
}
