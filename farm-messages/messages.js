'use strict';

const $ = id => document.getElementById(id);
const saveKey = 'fsg-live-farm-messages-v1';
const demoCode = 'FARM CHAT';
const months = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 15).toLocaleString('en-GB', { month: 'long' }));
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
const money = pennies => pounds.format(pennies / 100).replace(/\.00$/, '');
const choose = list => list[Math.floor(Math.random() * list.length)];
const people = {
  mechanic: ['Tom Bennett', 'Mechanic'],
  dealer: ['Hannah Reed', 'Machinery dealer'],
  vet: ['Priya Shah', 'Vet'],
  supplier: ['Jo Ellis', 'Feed and supplies'],
  neighbour: ['George Miller', 'Neighbour'],
  worker: ['Sam Cooper', 'Farmhand'],
  accountant: ['Helen Carter', 'Accountant'],
};
const tractor = 'machinery/machinery-workshop.webp';
const catalogue = [
  { contact: 'mechanic', type: 'repair', item: 'tractor', photo: tractor, amounts: [300, 400, 500],
    text: 'That warning light sounds like a charging fault. Leave the tractor parked for now. Can you drop it at the workshop?' },
  { contact: 'mechanic', type: 'repair', item: 'baler', photo: 'machinery/baler-breakdown.webp', amounts: [400, 500, 600], season: [5, 6, 7, 8],
    text: 'If the baler’s making that noise, park it up before it takes the bearings with it. I can get it into the workshop.' },
  { contact: 'mechanic', type: 'service', photo: tractor, amounts: [200, 300], season: [0, 1, 10, 11],
    text: 'I’ve got space for a routine service in the workshop. Shall I put you down for it?' },
  { contact: 'dealer', type: 'expense', photo: 'dealership/category-7.webp', amounts: [200, 300], reason: 'Replacement parts',
    text: 'I can get a set of filters and belts in with tomorrow’s order. Want me to add a set for your farm?' },
  { contact: 'dealer', type: 'credit', photo: 'dealership/category-7.webp', amounts: [100, 200], reason: 'Parts credit',
    text: 'I’ve put a credit on your parts account after that open day draw. It’ll come off an order with us.' },
  { contact: 'vet', type: 'expense', livestock: true, photo: 'animals/category-3.webp', amounts: [100, 200], reason: 'Routine livestock visit',
    text: 'I’m visiting farms nearby tomorrow. Shall I call in for that routine livestock check?' },
  { contact: 'supplier', type: 'expense', photo: 'supplies-storage/category-4.webp', amounts: [200, 300], reason: 'Workshop supplies',
    text: 'I have a spare delivery slot this week. Shall I send out those workshop supplies we talked about?' },
  { contact: 'neighbour', type: 'expense', photo: 'community/category-9.webp', amounts: [200, 400], reason: 'Contractor work',
    text: 'I’m finishing a job down the road and could bring the hedge cutter over. Do you want me to pencil you in?' },
  { contact: 'neighbour', type: 'income', amounts: [300, 500], reason: 'Agricultural show prize', season: [5, 6, 7, 8],
    text: 'Had a ring from the show secretary. You’ve won a cash prize! I’ve asked Helen to put it in the accounts.' },
  { contact: 'worker', type: 'note', season: [5, 6, 7, 8],
    text: 'I’ve checked the yard and put the spare fuel cans away. Let me know if you want a hand getting ready for harvest.' },
  { contact: 'worker', type: 'note', sheep: true,
    text: 'Two new lambs in the pen this morning. Both on their feet and feeding.',
    guidance: 'If you keep sheep, add two lambs to your flock using your usual house rules.' },
  { contact: 'dealer', type: 'note', text: 'Your parts catalogue is at the counter. Pick it up whenever you’re passing.' },
  { contact: 'neighbour', type: 'note', season: [0, 1, 11], text: 'The lane was icy at the bend this morning. Take it steady if you’re heading out.' },
  { contact: 'worker', type: 'note', text: 'I found the spare gate pin in the workshop. I’ve left it on the bench.' },
  { contact: 'supplier', type: 'note', text: 'Just a heads-up that we’ll be closing early at the end of the month for stocktaking.' },
  { contact: 'accountant', type: 'income', amounts: [200, 400], reason: 'Insurance compensation',
    text: 'The insurer has paid the agreed settlement. I’ve recorded it under compensation.' },
];

function fresh() {
  return {
    month: 2, year: 1, day: 1, tick: 0, started: false, contact: 'mechanic',
    settings: { repairProvider: 'dealer', mechanicSalary: 12000, workshop: false, start: 2, days: 3, frequency: '1', billing: 1, guidance: false, animals: false, sheep: false, sync: false },
    days: 3, billing: 1, billingMonths: 0, serial: 0,
    queue: [], messages: [], incidents: [], ledger: [], staff: [], statements: [], unread: {},
    monthClosed: false, imported: [], notifications: false, sound: true,
  };
}
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey));
    if (!saved) return fresh();
    saved.settings = { ...fresh().settings, ...saved.settings };
    saved.sound ??= true;
    return saved;
  } catch {
    return fresh();
  }
}
let farm = readState();
let messageView = 'inbox';
let audio;
const monthName = () => months[farm.month];
const period = () => `${monthName()} · Year ${farm.year}`;
const dateStamp = () => `${period()} · Day ${farm.day}`;
const monthId = () => farm.year * 12 + farm.month;
const nextId = () => ++farm.serial;

function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(farm));
    $('save-status').textContent = '';
  } catch {
    $('save-status').textContent = 'This browser could not save your progress.';
  }
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(label, action, className) {
  const element = node('button', label, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}
function unlockSound() {
  if (!farm.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audio && Audio) audio = new Audio();
    if (audio && audio.state !== 'running') return audio.resume().catch(() => {});
  } catch {}
}
document.addEventListener('pointerdown', unlockSound);
document.addEventListener('click', unlockSound, true);
document.addEventListener('keydown', unlockSound);
function chime() {
  if (!farm.sound || audio?.state !== 'running') return;
  [660, 880].forEach((frequency, index) => {
    const start = audio.currentTime + index * .1;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(.001, start);
    volume.gain.exponentialRampToValueAtTime(.22, start + .015);
    volume.gain.exponentialRampToValueAtTime(.001, start + .22);
    tone.connect(volume).connect(audio.destination);
    tone.start(start);
    tone.stop(start + .23);
  });
}
function renderSound() {
  $('sound').setAttribute('aria-pressed', String(farm.sound));
}
$('sound').addEventListener('click', async () => {
  farm.sound = !farm.sound;
  save();
  renderSound();
  if (farm.sound) {
    await unlockSound();
    chime();
  }
});
function notify(contact, text) {
  chime();
  if (!farm.notifications || !document.hidden || !('Notification' in window) ||
      Notification.permission !== 'granted') return;
  try {
    new Notification(`Farm Messages · ${people[contact][0]}`, { body: text });
  } catch {
    // Some mobile browsers require a service worker to display notifications.
  }
}
function message(contact, text, extra = {}) {
  farm.messages.push({ contact, text, date: dateStamp(), ...extra });
  if (!extra.sent && (contact !== farm.contact || messageView === 'inbox')) farm.unread[contact] = (farm.unread[contact] || 0) + 1;
  if (!extra.sent) notify(contact, text);
}
function selectContact(contact) {
  showPage('chats');
  messageView = 'chat';
  farm.contact = contact;
  farm.unread[contact] = 0;
}
function reply(label, action, className) {
  const contact = farm.contact;
  $('composer-label').hidden = false;
  $('replies').append(button(label, () => {
    message(contact, label, { sent: true });
    action();
    save();
    render();
    $('chat-title').focus({ preventScroll: true });
  }, className));
}

function addEntry(source, reason, amount, type = 'expense', extra = {}) {
  const entry = { id: nextId(), month: monthId(), date: period(), source, reason, amount, type, ...extra };
  farm.ledger.push(entry);
  if (type === 'credit' && !entry.applied) {
    entry.remaining = amount;
    for (const bill of unpaid().filter(item => !item.statement && item.source.toLowerCase() === source.toLowerCase())) {
      const used = Math.min(entry.remaining, net(bill));
      bill.credit = (bill.credit || 0) + used;
      entry.remaining -= used;
    }
  }
  if (type === 'expense' && !entry.applied) {
    entry.credit = 0;
    for (const credit of farm.ledger.filter(item => item.type === 'credit' && item.remaining > 0 &&
      item.source.toLowerCase() === source.toLowerCase())) {
      const used = Math.min(credit.remaining, amount - entry.credit);
      credit.remaining -= used;
      entry.credit += used;
    }
  }
  return entry;
}
const unpaid = () => farm.ledger.filter(e => e.type === 'expense' && !e.applied && !e.paid);
const net = entry => entry.amount - (entry.credit || 0);
const total = (entries, get = entry => entry.amount) => entries.reduce((sum, entry) => sum + get(entry), 0);

// Only explicitly identified cash payments and supplier credits are imported.
const cashEvents = new Set([
  'book-07-233', 'book-05-135', 'book-05-136', 'book-05-137', 'book-05-138',
  'book-05-139', 'book-05-140', 'book-05-141', 'book-05-142', 'book-05-143', 'weather-2026-29',
]);
const dealerCredits = new Set([
  'book-07-232', 'book-07-234', 'book-07-236', 'book-07-238', 'book-07-239',
]);
function importRewards() {
  if (!farm.settings.sync || farm.monthClosed) return;
  try {
    const events = JSON.parse(localStorage.getItem('fsg-first-events-test-v1'));
    if (!Array.isArray(events?.active) || (events.currency && events.currency !== 'GBP')) return;
    for (const event of events.active) {
      if (!event?.completed || !event.id || farm.imported.includes(event.id)) continue;
      const description = String(event.description || '');
      const credit = dealerCredits.has(event.eventId);
      const qualifies = cashEvents.has(event.eventId) || credit ||
        (event.category === 3 && /;\s*receive a £[\d,]+ bonus\./i.test(description));
      const amount = (event.category === 3 ? description.match(/receive a £([\d,]+) bonus/i) :
        description.match(/£([\d,]+)/))?.[1];
      if (!qualifies || !amount) continue;
      addEntry(credit ? people.dealer[0] : 'Farm Events', event.title,
        Number(amount.replaceAll(',', '')) * 100, credit ? 'credit' : 'income', {
          imported: true,
          // A completed card may already have been applied to the game.
          applied: true,
        });
      farm.imported.push(event.id);
    }
  } catch {
    // An unavailable Farm Events save should never prevent messages from loading.
  }
}

function planMonth(first = false) {
  const count = farm.settings.frequency === 'random' ? 1 + Math.floor(Math.random() * 10) :
    Number(farm.settings.frequency);
  const pool = catalogue.filter(event => (!event.livestock || farm.settings.animals) && (!event.sheep || farm.settings.sheep) &&
    !(event.type === 'repair' && farm.incidents.some(incident => incident.type === 'repair' &&
      incident.item === event.item && incident.stage !== 'closed')));
  const scheduled = [];
  if (first) scheduled.push(catalogue[0]);
  while (scheduled.length < count) {
    const available = pool.filter(event => !scheduled.includes(event));
    if (!available.length) break;
    const weighted = available.flatMap(event => event.season?.includes(farm.month) ? [event, event, event] : [event]);
    scheduled.push(choose(weighted));
  }
  farm.queue = scheduled.map((event, index) => ({
    event, day: first && index === 0 ? 1 : 1 + Math.floor(Math.random() * farm.days),
  }));
}
function offer(event) {
  const amount = choose(event.amounts || [0]) * 100;
  const info = { photo: event.photo, guidance: event.guidance };
  const source = people[event.contact][0];
  if (event.type === 'income' || event.type === 'credit') {
    addEntry(source, event.reason, amount, event.type);
    message(event.contact, `${event.text} ${money(amount)}.`, info);
    return;
  }
  if (event.type === 'note') {
    message(event.contact, event.text, info);
    return;
  }
  const incident = { ...event, id: nextId(), amount, stage: 'offer' };
  farm.incidents.push(incident);
  if (event.type === 'repair' && event.item === 'tractor') {
    incident.onFarm = farm.settings.repairProvider === 'staff';
    incident.contact = incident.onFarm ? 'mechanic' : 'dealer';
    incident.amount = incident.onFarm ? 10000 : 30000;
    incident.parking = farm.settings.workshop ? 'farm workshop' : 'farmyard';
    const quote = incident.onFarm
      ? 'I can fix it here. The parts will be £100.'
      : 'Workshop drop-off is £300, or we can come to you for £400.';
    message(incident.contact, `There’s a fault on your smallest tractor. ${quote}`, info);
    return;
  }
  const quote = amount ? ` It’ll be ${money(amount)}.` : '';
  message(event.contact, event.text + quote, info);
}
function runDay() {
  for (const incident of farm.incidents) {
    if (incident.stage === 'deferred' && farm.tick >= incident.due) {
      incident.stage = 'offer';
      message(incident.contact, 'Just checking whether you still want that service. Happy to leave it with you.');
    } else if (incident.stage === 'repairing' && farm.tick >= incident.due) {
      if (incident.delay) {
        incident.delay = false;
        incident.due += 2;
        message(incident.contact, `Bit more to it than I thought. I’ll need another two days on the ${incident.item}. The quote still stands.`);
      } else {
        incident.stage = 'closed';
        addEntry(people[incident.contact][0], `${incident.item} repair`, incident.amount);
        message(incident.contact, `The ${incident.item} is fixed and ready to collect. I’ve sent the invoice to Helen.`);
      }
    }
  }
  for (const item of farm.queue.filter(item => item.day === farm.day)) offer(item.event);
  farm.queue = farm.queue.filter(item => item.day !== farm.day);
  importRewards();
}
function beginMonth(first = false) {
  farm.started = true;
  farm.days = farm.settings.days;
  farm.day = 1;
  farm.monthClosed = false;
  planMonth(first);
  runDay();
}
function nextDay() {
  if (!farm.started) {
    beginMonth(true);
  } else if (farm.day < farm.days) {
    farm.day++;
    farm.tick++;
    runDay();
  } else {
    selectContact('accountant');
  }
  save();
  render();
}
function nextMonth() {
  if (++farm.month === 12) {
    farm.month = 0;
    farm.year++;
  }
  farm.tick++;
  beginMonth();
}
function closeMonth() {
  importRewards();
  for (const employee of farm.staff) {
    const share = Math.floor(employee.salary / 12);
    const remainder = employee.salary % 12;
    const amount = share + (employee.months % 12 < remainder ? 1 : 0);
    employee.months++;
    addEntry(employee.name, 'Monthly salary', amount, 'expense', { applied: employee.applied });
  }
  if (farm.settings.repairProvider === 'staff') {
    const annualPence = farm.settings.mechanicSalary * 100;
    const instalment = Math.floor(annualPence / 12) + (farm.month < annualPence % 12 ? 1 : 0);
    addEntry(people.mechanic[0], 'Farm mechanic salary', instalment);
  }
  const entries = farm.ledger.filter(entry => entry.month === monthId());
  const costs = total(entries.filter(entry => entry.type === 'expense'), net);
  const income = total(entries.filter(entry => entry.type === 'income'));
  const credits = total(entries.filter(entry => entry.type === 'credit'));
  const outstanding = total(unpaid(), net);
  const summary = [
    `Here are ${monthName()}’s figures.`, `Costs ${money(costs)} · Cash income ${money(income)}`,
    `Supplier credits recorded ${money(credits)} · Outstanding bills ${money(outstanding)}`,
    ...entries.map(entry => `• ${entry.source} · ${entry.reason} · ${money(entry.type === 'expense' ? net(entry) : entry.amount)}${entry.applied ? ' (record only)' : ''}`),
  ];
  farm.monthClosed = true;
  message('accountant', summary.join('\n'));
  if (++farm.billingMonths < farm.billing) return;

  farm.billingMonths = 0;
  farm.billing = farm.settings.billing;
  const items = unpaid().filter(entry => !entry.statement);
  for (const entry of items.filter(entry => net(entry) === 0)) entry.paid = true;
  const payable = items.filter(entry => !entry.paid);
  if (!payable.length) {
    message('accountant', 'This billing period is closed. There’s no new payment due.');
    return;
  }
  const statement = { id: nextId(), date: period(), month: monthName(), total: total(payable, net) };
  farm.statements.push(statement);
  payable.forEach(entry => { entry.statement = statement.id; });
  message('accountant', [
    `The ${monthName()} statement is due. Total to pay: ${money(statement.total)}.`,
    ...payable.map(entry => `• ${entry.source} · ${entry.reason} · ${money(net(entry))}${entry.credit ? ` after ${money(entry.credit)} credit` : ''}`),
    'Let me know once you’ve paid it in your save.',
  ].join('\n'));
}

function activeIncident(contact) {
  return farm.incidents.find(incident => incident.contact === contact &&
    ['offer', 'drop-off'].includes(incident.stage));
}
function renderReplies() {
  $('replies').replaceChildren();
  $('composer-label').hidden = true;
  if (!farm.started) {
    $('replies').append(node('p', 'Open Farm settings to match your save, then start receiving messages.'));
    return;
  }
  if (farm.contact === 'accountant') {
    if (farm.day === farm.days && !farm.monthClosed) {
      reply(`Can I have ${monthName()}’s accounts?`, closeMonth, 'primary');
    }
    if (farm.monthClosed) reply('Thanks very much', nextMonth, 'primary');
    reply('What’s outstanding at the moment?', () => {
      importRewards();
      const amount = total(unpaid(), net);
      message('accountant', amount ? `There’s ${money(amount)} outstanding, including bills that aren’t due yet.` :
        'You’re all square at the moment.');
    });
    for (const statement of farm.statements.filter(item => !item.paid)) {
      reply(`I’ve paid the ${statement.date} statement (${money(statement.total)})`, () => {
        statement.paid = true;
        for (const entry of farm.ledger.filter(item => item.statement === statement.id)) entry.paid = true;
        message('accountant', 'Thanks. I’ve marked that statement as paid.');
      });
    }
    return;
  }
  if (farm.monthClosed) {
    $('replies').append(node('p', 'This month’s accounts are ready. Reply to Helen to open the next month.'));
    return;
  }
  const incident = activeIncident(farm.contact);
  if (!incident) {
    $('replies').append(node('p', 'No reply needed right now.'));
    return;
  }
  const contact = incident.contact;
  if (incident.type === 'repair' && incident.parking) {
    if (incident.stage === 'drop-off') {
      reply('I’ve parked the tractor', () => {
        incident.stage = 'closed';
        addEntry(people[contact][0], incident.onFarm ? 'Tractor repair parts' : 'Dealer tractor repair', incident.amount);
        message(contact, `That’s the tractor sorted. I’ve sent the ${money(incident.amount)} charge to Helen.`);
      }, 'primary');
      return;
    }
    const book = (location, amount) => {
      incident.amount = amount;
      incident.stage = 'drop-off';
      message(contact, `Leave the tractor at the ${location} and text me when it’s parked.`);
    };
    if (incident.onFarm) {
      reply('Go ahead with the repair', () => book(incident.parking, 10000), 'primary');
    } else {
      reply('I’ll bring it to the dealership', () => book('dealership', 30000), 'primary');
      reply('Book a call-out', () => book(incident.parking, 40000));
    }
    return;
  }
  if (incident.stage === 'drop-off') {
    reply(`I’ve dropped the ${incident.item} off`, () => {
      incident.stage = 'repairing';
      incident.due = farm.tick + 2;
      incident.delay = Math.random() < .3;
      message(contact, 'Got it in the yard. Should take two days. I’ll text when it’s ready.');
    }, 'primary');
    return;
  }
  if (incident.type === 'repair') {
    reply('I’ll bring it over', () => {
      incident.stage = 'drop-off';
      message(contact, 'Sounds good. Text me when it’s in the workshop yard.', {
        guidance: `Move the ${incident.item} to your chosen workshop and leave it out of use until Tom texts you.`,
      });
    }, 'primary');
    reply('It’ll have to wait', () =>
      message(contact, `Give me a shout when you can bring it. Leave the ${incident.item} parked meanwhile.`));
    return;
  }
  const service = incident.type === 'service';
  reply(service ? 'Yes, book me in' : 'Yes, please go ahead', () => {
    incident.stage = 'closed';
    addEntry(people[contact][0], incident.reason || 'Routine service', incident.amount);
    message(contact, `That’s sorted. I’ll put the ${money(incident.amount)} on the farm account.`);
  }, 'primary');
  if (service && !incident.deferred) {
    reply('Can we leave it for now?', () => {
      incident.stage = 'deferred';
      incident.deferred = true;
      incident.due = farm.tick + 3;
      message(contact, 'No rush. I’ll check in again in a few days.');
    });
  }
  reply('No thanks', () => {
    incident.stage = 'closed';
    message(contact, 'No problem. Give me a shout if you change your mind.');
  });
}
const portraitPath = contact => `portraits/${contact}.webp`;
function avatar(contact) {
  const image = node('img', undefined, 'avatar');
  image.src = portraitPath(contact);
  image.alt = '';
  image.width = 48;
  image.height = 48;
  return image;
}
function renderChat() {
  const [name, role] = people[farm.contact];
  const title = node('h2', name);
  title.id = 'chat-title';
  title.tabIndex = -1;
  const info = node('div');
  info.append(title, node('span', role, 'contact-role'));
  const back = button('‹', () => {
    messageView = 'inbox';
    $('workspace').setAttribute('data-view', messageView);
    $('inbox-title').focus({ preventScroll: true });
  }, 'chat-back');
  back.setAttribute('aria-label', 'Back to messages');
  $('chat-header').replaceChildren(back, avatar(farm.contact), info);
  const stream = $('conversation');
  const messages = farm.messages.filter(item => item.contact === farm.contact);
  const output = [];
  let previousDate;
  for (const item of messages) {
    if (item.date !== previousDate) {
      output.push(node('time', item.date, 'chat-date'));
      previousDate = item.date;
    }
    const bubble = node('div', item.text, item.sent ? 'bubble sent' : 'bubble received');
    bubble.setAttribute('aria-label', item.sent ? 'You' : name);
    if (item.photo) {
      const image = node('img');
      image.src = '../random-events/images/' + item.photo;
      image.alt = 'Farm scene attached to this message';
      bubble.append(image);
    }
    if (item.guidance && farm.settings.guidance) bubble.append(node('p', item.guidance, 'game-note'));
    const row = node('div', undefined, item.sent ? 'message-row outgoing' : 'message-row');
    if (!item.sent) row.append(avatar(item.contact));
    row.append(bubble);
    output.push(row);
  }
  if (!output.length) output.push(node('p', 'No messages yet.', 'empty-chat'));
  stream.replaceChildren(...output);
  stream.scrollTop = stream.scrollHeight;
  renderReplies();
}
function renderContacts() {
  $('contacts').replaceChildren();
  const latest = new Map();
  for (const [index, item] of farm.messages.entries()) latest.set(item.contact, { item, index });
  const query = $('contact-search').value.trim().toLowerCase();
  const contacts = Object.entries(people).filter(([, [name, role]]) =>
    `${name} ${role}`.toLowerCase().includes(query)).sort(([a], [b]) =>
    (latest.get(b)?.index ?? -1) - (latest.get(a)?.index ?? -1));
  for (const [id, [name, role]] of contacts) {
    const contact = button('', () => {
      selectContact(id);
      save();
      render();
      $('chat-title').focus({ preventScroll: true });
    }, 'contact');
    contact.setAttribute('aria-pressed', String(farm.contact === id));
    const last = latest.get(id)?.item;
    const preview = last ? (last.sent ? 'You: ' : '') + last.text.split('\n')[0] : role;
    const label = node('span', undefined, 'contact-copy');
    label.append(node('strong', name), node('small', preview));
    contact.append(avatar(id), label);
    if (farm.unread[id]) {
      const unread = node('span', String(farm.unread[id]), 'unread');
      unread.setAttribute('aria-label', `${farm.unread[id]} unread`);
      contact.append(unread);
    }
    $('contacts').append(contact);
  }
  if (!contacts.length) $('contacts').append(node('p', 'No matching contacts.', 'empty-chat'));
}
function renderJobs() {
  const jobs = farm.incidents.filter(item => item.type === 'repair' && item.stage !== 'closed');
  $('no-jobs').hidden = jobs.length > 0;
  $('restrictions').replaceChildren(...jobs.map(item => {
    const status = item.stage === 'repairing' ? 'Repair in progress' :
      item.stage === 'drop-off' ? 'Waiting for you to park the machine' : 'Waiting for your reply';
    return button(`${item.item} · ${status}`, () => {
      showPage('chats');
      selectContact(item.contact);
      save();
      render();
      $('chat-title').focus();
    }, 'job-link');
  }));
}
function renderAccounts() {
  $('balance').textContent = `${money(total(unpaid(), net))} outstanding`;
  const rows = farm.ledger.slice().reverse().map(entry => {
    const row = node('div', undefined, 'ledger-row');
    const label = node('div', `${entry.source} · ${entry.reason}`);
    const status = entry.applied ? 'Record only' : entry.type === 'income' ? 'Cash income' :
      entry.type === 'credit' ? `${money(entry.remaining)} credit available` :
        entry.paid ? 'Settled' : entry.statement ? 'Due' : 'Accumulating';
    label.append(node('small', `${entry.date} · ${status}${entry.credit ? ` · ${money(entry.credit)} credit used` : ''}`));
    row.append(label, node('strong', money(entry.type === 'expense' ? net(entry) : entry.amount)));
    return row;
  });
  if (!rows.length) rows.push(node('p', 'No transactions recorded yet.'));
  $('ledger').replaceChildren(...rows);
  $('entry').hidden = farm.monthClosed;
  const employees = farm.staff.map(employee => {
    const row = node('div', undefined, 'staff-row');
    row.append(node('span', `${employee.name} · ${money(employee.salary)} a year${employee.applied ? ' · record only' : ''}`),
      button('Remove', () => {
        farm.staff = farm.staff.filter(item => item.id !== employee.id);
        save();
        renderAccounts();
      }));
    return row;
  });
  $('staff-list').replaceChildren(...employees);
}
function showPage(page) {
  $('workspace').hidden = page !== 'chats';
  for (const name of ['jobs', 'calendar', 'accounts']) $(`${name}-page`).hidden = name !== page;
  for (const tab of $('message-nav').querySelectorAll('button')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.page === page));
  }
}
$('message-nav').addEventListener('click', event => {
  const tab = event.target.closest('button[data-page]');
  if (tab) showPage(tab.dataset.page);
});
$('contact-search').addEventListener('input', renderContacts);
$('start-chats').addEventListener('click', () => $('advance').click());

function render() {
  renderSound();
  $('start-chats').hidden = farm.started;
  renderJobs();
  $('workspace').setAttribute('data-view', messageView);
  $('date').textContent = period();
  $('day').textContent = `Day ${farm.day} of ${farm.days}`;
  $('advance').textContent = !farm.started ? 'Start farm messages' :
    farm.day < farm.days ? `Advance to Day ${farm.day + 1}` : 'Open accountant chat';
  renderContacts();
  renderChat();
  renderAccounts();
}

const settings = $('settings').elements;
months.forEach((month, index) => settings.start.add(new Option(month, index)));
for (let count = 1; count <= 10; count++) settings.frequency.add(new Option(count, count));
function loadSettings() {
  for (const [key, value] of Object.entries(farm.settings)) {
    if (settings[key].type === 'checkbox') settings[key].checked = value;
    else settings[key].value = value;
  }
  settings.start.disabled = farm.started;
}
$('settings').addEventListener('submit', event => {
  event.preventDefault();
  farm.settings = {
    repairProvider: settings.repairProvider.value, mechanicSalary: Number(settings.mechanicSalary.value),
    workshop: settings.workshop.checked,
    start: Number(settings.start.value), days: Number(settings.days.value), frequency: settings.frequency.value,
    billing: Number(settings.billing.value), guidance: settings.guidance.checked,
    animals: settings.animals.checked, sheep: settings.sheep.checked, sync: settings.sync.checked,
  };
  if (!farm.started) {
    farm.month = farm.settings.start;
    farm.days = farm.settings.days;
    // Keep any setup entries under the starting month selected by the player.
    for (const entry of farm.ledger) {
      entry.month = monthId();
      entry.date = period();
    }
  }
  if (farm.billingMonths === 0) farm.billing = farm.settings.billing;
  importRewards();
  $('settings-status').textContent = 'Settings saved. Calendar and event frequency changes apply at the start of the next month once play begins. Billing changes apply after the current billing period.';
  save();
  render();
});
$('advance').addEventListener('click', () => {
  const starting = !farm.started;
  if (starting) selectContact('mechanic');
  nextDay();
  settings.start.disabled = true;
  if (starting || (farm.day === farm.days && farm.contact === 'accountant')) $('chat-title').focus({ preventScroll: true });
});

const entry = $('entry').elements;
function entryFields() {
  const hours = entry.type.value === 'worker';
  $('hours-label').hidden = !hours;
  entry.hours.required = hours;
  if (!hours) entry.hours.value = '';
  $('amount-label').textContent = hours ? 'Hourly rate (£)' : 'Amount (£)';
}
entry.type.addEventListener('change', entryFields);
$('entry').addEventListener('submit', event => {
  event.preventDefault();
  if (farm.monthClosed) return;
  const kind = entry.type.value;
  const source = entry.source.value.trim();
  const reason = entry.reason.value.trim();
  if (!source || !reason) return;
  const hours = kind === 'worker' ? Number(entry.hours.value) : 1;
  const description = kind === 'worker' ? `${reason} (${hours} hours)` : reason;
  const type = ['credit', 'income'].includes(kind) ? kind : 'expense';
  addEntry(source, description, Math.round(Number(entry.amount.value) * hours * 100), type,
    { applied: entry.applied.checked });
  $('entry').reset();
  entryFields();
  save();
  renderAccounts();
});
$('staff').addEventListener('submit', event => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const name = fields.namedItem('name').value.trim();
  if (!name) return;
  farm.staff.push({ id: nextId(), name, salary: Math.round(Number(fields.salary.value) * 100),
    months: 0, applied: fields.applied.checked });
  event.currentTarget.reset();
  save();
  renderAccounts();
});
$('notify').addEventListener('click', async () => {
  if (farm.notifications) {
    farm.notifications = false;
    $('notify').textContent = 'Enable browser notifications';
    $('notify-status').textContent = 'Notifications turned off.';
    save();
    return;
  }
  let allowed = false;
  try {
    allowed = 'Notification' in window && await Notification.requestPermission() === 'granted';
  } catch {
    // The current device or context may not offer notification permission.
  }
  farm.notifications = allowed;
  $('notify').textContent = allowed ? 'Disable browser notifications' : 'Enable browser notifications';
  $('notify-status').textContent = allowed ? 'Notifications enabled while this page is open in the background.' :
    'Notifications are unavailable or blocked in this browser.';
  save();
});
$('open-farm-tools').addEventListener('click', () => $('farm-tools').showModal());
$('reset').addEventListener('click', () => {
  $('reset-dialog').returnValue = '';
  $('reset-dialog').showModal();
});
$('reset-dialog').addEventListener('close', () => {
  if ($('reset-dialog').returnValue !== 'reset') return;
  $('farm-tools').close();
  farm = fresh();
  messageView = 'inbox';
  $('notify').textContent = 'Enable browser notifications';
  $('notify-status').textContent = 'Notifications are available while this page is open on supported browsers.';
  loadSettings();
  save();
  render();
});
function openDemo() {
  $('gate').hidden = true;
  $('app').hidden = false;
  loadSettings();
  $('notify').textContent = farm.notifications ? 'Disable browser notifications' : 'Enable browser notifications';
  importRewards();
  save();
  render();
}
$('unlock').addEventListener('submit', event => {
  event.preventDefault();
  if ($('code').value.trim().replace(/\s+/g, ' ').toUpperCase() !== demoCode) {
    $('code-status').textContent = 'That demo code isn’t recognised.';
    return;
  }
  try { sessionStorage.setItem(saveKey, 'open'); } catch {}
  openDemo();
  (farm.started ? $('contact-search') : $('start-chats')).focus();
});
window.addEventListener('storage', event => {
  if ($('app').hidden) return;
  if (event.key === saveKey) {
    farm = readState();
    loadSettings();
    render();
  } else if (event.key === 'fsg-first-events-test-v1' && farm.settings.sync) {
    importRewards();
    save();
    renderAccounts();
  }
});
try {
  if (sessionStorage.getItem(saveKey) === 'open') openDemo();
} catch {}
