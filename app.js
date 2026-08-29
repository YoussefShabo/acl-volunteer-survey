const dates = [
  { day: 'Friday', date: 'October 2', short: 'OCT 02' },
  { day: 'Saturday', date: 'October 3', short: 'OCT 03' },
  { day: 'Sunday', date: 'October 4', short: 'OCT 04' },
  { day: 'Friday', date: 'October 9', short: 'OCT 09' },
  { day: 'Saturday', date: 'October 10', short: 'OCT 10' },
  { day: 'Sunday', date: 'October 11', short: 'OCT 11' }
];
const shifts = [
  { id: 'early', label: 'Shift one', time: '12—5 PM' },
  { id: 'late', label: 'Shift two', time: '5—10 PM' }
];
const storageKey = 'event-crew-volunteer-responses';
let selected = new Set();
let backendAvailable = false;
let backendResponses = [];

const matrix = document.querySelector('#shift-matrix');
const selectedCount = document.querySelector('#selected-count');
const form = document.querySelector('#signup-form');
const message = document.querySelector('#form-message');
const organizer = document.querySelector('#organizer');
const toast = document.querySelector('#toast');

function renderMatrix() {
  [dates.slice(0, 3), dates.slice(3)].forEach((weekDates, weekIndex) => {
    const group = document.createElement('section');
    group.className = 'week-group';
    group.innerHTML = `<h3>WEEKEND ${weekIndex + 1}</h3><div class="date-row"></div>`;
    const dateRow = group.querySelector('.date-row');
    weekDates.forEach((date, dateOffset) => {
      const dateIndex = weekIndex * 3 + dateOffset;
      const heading = document.createElement('div');
      heading.className = 'date-heading';
      heading.innerHTML = `<span class="day">${date.day}</span><strong>${date.short}</strong>`;
      dateRow.appendChild(heading);
    });
    shifts.forEach((shift) => {
      const row = document.createElement('div');
      row.className = 'shift-row';
      weekDates.forEach((date, dateOffset) => {
        const dateIndex = weekIndex * 3 + dateOffset;
      const key = `${dateIndex}-${shift.id}`;
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'shift-option';
      option.dataset.key = key;
      option.setAttribute('aria-pressed', 'false');
      option.innerHTML = `<span class="pick-label">AVAILABLE</span><span class="time">${shift.time}</span>`;
      option.addEventListener('click', () => toggleShift(key, option));
        row.appendChild(option);
      });
      group.appendChild(row);
    });
    matrix.appendChild(group);
  });
}

function toggleShift(key, option) {
  if (selected.has(key)) {
    selected.delete(key);
    option.classList.remove('selected');
    option.setAttribute('aria-pressed', 'false');
  } else {
    selected.add(key);
    option.classList.add('selected');
    option.setAttribute('aria-pressed', 'true');
  }
  const count = selected.size;
  selectedCount.textContent = `${count} shift${count === 1 ? '' : 's'}`;
  document.querySelector('.selection-status').querySelector('span').nextSibling.textContent = count ? ' Choose any additional shifts' : ' Choose one or more to continue';
}

function getResponses() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
}
function saveResponses(responses) { localStorage.setItem(storageKey, JSON.stringify(responses)); }
async function checkBackend() {
  try {
    const response = await fetch('/api/health');
    const result = await response.json();
    backendAvailable = result.configured === true;
    if (backendAvailable) {
      const rosterResponse = await fetch('/api/responses');
      if (!rosterResponse.ok) throw new Error('Roster unavailable');
      backendResponses = (await rosterResponse.json()).responses;
    }
  } catch {
    backendAvailable = false;
  }
  renderRoster();
}
function shiftLabel(key) {
  if (key.includes(' / ')) return key;
  const [dateIndex, shiftId] = key.split('-');
  const date = dates[Number(dateIndex)];
  const shift = shifts.find((item) => item.id === shiftId);
  return `${date.short} / ${shift.time}`;
}
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3000);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#name').value.trim();
  const email = document.querySelector('#email').value.trim();
  if (!selected.size) { message.textContent = 'Select at least one shift before sending.'; return; }
  if (!name || !email || !document.querySelector('#email').checkValidity()) { message.textContent = 'Add your name and a valid email address to continue.'; return; }
  const response = { id: Date.now().toString(), name, email, note: document.querySelector('#note').value.trim(), shifts: [...selected], submittedAt: new Date().toISOString() };
  if (backendAvailable) {
    try {
      const backendResponse = await fetch('/api/responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
      if (!backendResponse.ok) throw new Error('Could not save response');
      backendResponses.push(response);
    } catch {
      saveResponses([...getResponses(), response]);
      showToast('Saved locally. Google Sheets was unavailable.');
    }
  } else {
    saveResponses([...getResponses(), response]);
  }
  form.reset();
  selected.clear();
  document.querySelectorAll('.shift-option.selected').forEach((option) => { option.classList.remove('selected'); option.setAttribute('aria-pressed', 'false'); });
  selectedCount.textContent = '0 shifts';
  document.querySelector('.selection-status').querySelector('span').nextSibling.textContent = ' Choose one or more to continue';
  message.textContent = '';
  if (!toast.classList.contains('show')) showToast('Availability received. Thank you!');
  renderRoster();
});

document.querySelector('#open-organizer').addEventListener('click', () => { organizer.classList.add('visible'); organizer.scrollIntoView({ behavior: 'smooth' }); renderRoster(); });
document.querySelector('#close-organizer').addEventListener('click', () => organizer.classList.remove('visible'));
document.querySelector('#search-input').addEventListener('input', renderRoster);
document.querySelector('#export-button').addEventListener('click', () => {
  const responses = getResponses();
  if (!responses.length) { showToast('There are no responses to export yet.'); return; }
  const rows = [['Name', 'Email', 'Selected shifts', 'Note', 'Submitted']];
  responses.forEach((response) => rows.push([response.name, response.email, response.shifts.map(shiftLabel).join('; '), response.note, new Date(response.submittedAt).toLocaleString()]));
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'event-crew-volunteers.csv';
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector('#roster-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  const responses = getResponses().filter((response) => response.id !== button.dataset.delete);
  saveResponses(responses);
  renderRoster();
  showToast('Response removed.');
});

function renderRoster() {
  const query = document.querySelector('#search-input').value.trim().toLowerCase();
  const responses = backendAvailable ? backendResponses : getResponses();
  const filtered = responses.filter((response) => `${response.name} ${response.email}`.toLowerCase().includes(query));
  document.querySelector('#response-count').textContent = responses.length;
  document.querySelector('#shift-count').textContent = responses.reduce((total, response) => total + response.shifts.length, 0);
  const body = document.querySelector('#roster-body');
  body.innerHTML = filtered.map((response) => `<tr><td>${escapeHtml(response.name)}</td><td>${escapeHtml(response.email)}</td><td>${response.shifts.map((key) => `<span class="shift-pill">${shiftLabel(key)}</span>`).join('')}</td><td>${escapeHtml(response.note || '—')}</td><td><button class="delete-button" type="button" data-delete="${response.id}" aria-label="Remove ${escapeHtml(response.name)}">×</button></td></tr>`).join('');
  document.querySelector('#empty-state').hidden = filtered.length > 0;
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

renderMatrix();
renderRoster();
checkBackend();
