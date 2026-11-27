'use strict';

const $ = id => document.getElementById(id);
const saveKey = 'fsg-live-farm-messages-v1';
const months = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 15).toLocaleString('en-GB', { month: 'long' }));
const currencies = { GBP: '£', USD: '$', EUR: '€' };
const money = cents => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: farm.settings.currency, currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
}).format(cents / 100);
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
  { contact: 'mechanic', type: 'repair', item: 'tractor', scenario: 'battery', photo: tractor },
  { contact: 'mechanic', type: 'repair', item: 'tractor', scenario: 'tyre', photo: tractor },
  { contact: 'mechanic', type: 'repair', item: 'combine header', scenario: 'header', photo: tractor },
  { contact: 'mechanic', type: 'repair', item: 'baler', photo: 'machinery/baler-breakdown.webp', amounts: [400, 500, 600], season: [5, 6, 7, 8],
    text: 'I noticed the baler’s making a noise. Park it up before it takes the bearings with it. I can get it into the workshop.' },
  { contact: 'dealer', type: 'credit', photo: 'dealership/category-7.webp', amounts: [100, 200], reason: 'Parts credit',
    text: 'I’ve put a credit on your parts account after that open day draw. It’ll come off an order with us.' },
  { contact: 'vet', type: 'expense', livestock: true, photo: 'animals/category-3.webp', amounts: [100, 200], reason: 'Routine livestock visit',
    text: 'I’m visiting farms nearby tomorrow. Shall I call in for that routine livestock check?' },
  { contact: 'supplier', type: 'expense', photo: 'supplies-storage/category-4.webp', amounts: [200, 300], reason: 'Workshop supplies',
    text: 'I have a spare delivery slot this week. Shall I send out those workshop supplies we talked about?' },
  { contact: 'neighbour', type: 'expense', photo: 'community/category-9.webp', amounts: [200, 400], reason: 'Contractor work',
    text: 'I’m finishing a job down the road and could bring the hedge cutter over. Do you want me to pencil you in?' },
  { contact: 'neighbour', type: 'income', amounts: [300, 500], reason: 'Agricultural show prize', season: [5, 6, 7, 8],
    text: 'Had a ring from the show secretary. You’ve won a cash prize! I’ve asked the accountant to put it in the accounts.' },
  { contact: 'worker', type: 'note', season: [5, 6, 7, 8],
    text: 'I’ve checked the yard and put the spare fuel cans away. Let me know if you want a hand getting ready for harvest.' },
  { contact: 'worker', type: 'note', sheep: true,
    text: 'Two new lambs in the pen this morning. Both on their feet and feeding.',
    guidance: 'If you keep sheep, add two lambs to your flock using your usual house rules.' },
  { contact: 'dealer', type: 'note', text: 'Your parts catalogue is at the counter. Pick it up whenever you’re passing.' },
  { contact: 'neighbour', type: 'note', season: [0, 1, 11], text: 'The lane was icy at the bend this morning. Take it steady if you’re heading out.' },
  { contact: 'supplier', type: 'note', text: 'Just a heads-up that we’ll be closing early at the end of the month for stocktaking.' },
  { contact: 'accountant', type: 'income', amounts: [200, 400], reason: 'Insurance compensation',
    text: 'The insurer has paid the agreed settlement. I’ve recorded it under compensation.' },
];

function fresh() {
  const firstNames = ['Alex', 'Jamie', 'Morgan', 'Robin', 'Sam', 'Taylor'];
  const names = Object.fromEntries(Object.entries(people).map(([id, [name]]) =>
    [id, `${choose(firstNames)} ${name.split(' ').at(-1)}`]));
  return {
    names,
    contactPreferences: { mechanic: true, dealer: true },
    month: 2, year: 1, day: 1, tick: 0, started: false, contact: 'mechanic',
    settings: { currency: 'GBP', repairProvider: 'dealer', mechanicSalary: 12000, workshop: false, start: 2, days: 3, frequency: '1', delivery: 'day', mechanicPayroll: false, randomMin: 1, randomMax: 10, billing: 1, guidance: false, animals: false, sheep: false, sync: false },
    days: 3, billing: 1, billingMonths: 0, serial: 0,
    queue: [], pendingMessages: [], lastAutomaticMessage: {}, messages: [], incidents: [], ledger: [], staff: [], statements: [], unread: {},
    monthClosed: false, imported: [], notifications: false, sound: true,
  };
}
const isStandalonePartsOffer = event => event.type === 'expense' && event.reason === 'Replacement parts';
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey));
    if (!saved) return fresh();
    const payroll = saved.settings?.mechanicPayroll ?? (saved.settings?.repairProvider === 'staff');
    saved.settings = { ...fresh().settings, ...saved.settings, mechanicPayroll: payroll };
    saved.contactPreferences ??= { mechanic: true, dealer: true };
    saved.sound ??= true;
    saved.pendingMessages ??= [];
    saved.pendingMessages = saved.pendingMessages.filter(item =>
      !item.text?.startsWith('I can get a set of filters and belts in with tomorrow’s order.'));
    for (const incident of saved.incidents) {
      if (isStandalonePartsOffer(incident) && incident.stage === 'offer') incident.stage = 'closed';
    }
    saved.lastAutomaticMessage ??= {};
    return saved;
  } catch {
    return fresh();
  }
}
let farm = readState();
const assignedContact = role => farm.roleContacts?.[role] || role;
const contactName = id => farm.names?.[id]?.trim() || people[id][0];
let messageView = 'inbox';
let selectedJobId;
let expandedJobStatus;
let replyingTo;
let audio;
let chimeEndsAt = 0;
let toastTimer;
let deliveryTimer;
const monthName = () => months[farm.month];
const period = () => `${monthName()} · Year ${farm.year}`;
const dateStamp = () => `${period()} · Day ${farm.day}`;
const monthId = () => farm.year * 12 + farm.month;
const nextId = () => ++farm.serial;

function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(farm));
    $('save-status').textContent = '';
    return true;
  } catch {
    $('save-status').textContent = 'This browser could not save your progress.';
    return false;
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
  const now = audio.currentTime;
  if (now < chimeEndsAt) return;
  chimeEndsAt = now + .33;
  [660, 880].forEach((frequency, index) => {
    const start = now + index * .1;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(.001, start);
    volume.gain.exponentialRampToValueAtTime(.11, start + .015);
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
  if (!document.hidden && contact === farm.contact && messageView === 'chat' && !$('workspace').hidden && !$('farm-tools').open) return;
  chime();
  const alert = button('', () => {
    selectContact(contact);
    $('toast-region').replaceChildren();
    if ($('farm-tools').open) $('farm-tools').close();
    save();
    render();
    $('chat-title').focus();
  }, 'toast');
  const copy = node('span');
  copy.append(node('strong', contactName(contact)), node('small', text.split('\n')[0]));
  alert.append(avatar(contact), copy);
  $('toast-region').replaceChildren(alert);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast-region').replaceChildren(), 7000);
  if (!farm.notifications || !document.hidden || !('Notification' in window) ||
      Notification.permission !== 'granted') return;
  try {
    new Notification(`Farm Messages · ${contactName(contact)}`, { body: text, silent: true });
  } catch {
    // Some mobile browsers require a service worker to display notifications.
  }
}
function message(contact, text, extra = {}) {
  if (replyingTo) extra = { jobId: replyingTo.id, ...extra };
  farm.messages.push({ contact, text, date: dateStamp(), ...extra });
  if (!extra.sent && (contact !== farm.contact || messageView === 'inbox')) farm.unread[contact] = (farm.unread[contact] || 0) + 1;
  if (!extra.sent) notify(contact, text);
}
function automaticMessage(contact, text, extra = {}) {
  const previous = farm.lastAutomaticMessage[contact];
  const dueAt = previous == null ? Date.now() : Math.max(Date.now(), previous + messageDelay());
  farm.lastAutomaticMessage[contact] = dueAt;
  if (dueAt > Date.now()) {
    farm.pendingMessages.push({ contact, text, extra, dueAt });
  } else {
    message(contact, text, extra);
  }
}
function selectContact(contact, jobId) {
  if (contact !== farm.contact) $('conversation-history').open = false;
  selectedJobId = jobId;
  showPage('chats');
  messageView = 'chat';
  farm.contact = contact;
  farm.unread[contact] = 0;
}
function reply(label, action, className) {
  const contact = farm.contact;
  const job = farm.incidents.find(item => item.id === selectedJobId && item.contact === contact);
  ($('reply-actions') || $('replies')).append(button(label, () => {
    replyingTo = job;
    try {
      message(contact, label, { sent: true });
      action();
      if (job?.stage === 'closed') {
        job.closedMonth = monthId();
        selectedJobId = null;
        job.closeLabel = label === 'No thanks' ? 'Declined' : 'Completed';
      }
    } finally {
      replyingTo = undefined;
    }
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

function monthlyEventCount(settings) {
  if (settings.frequency !== 'random') return Number(settings.frequency);
  return settings.randomMin + Math.floor(Math.random() * (settings.randomMax - settings.randomMin + 1));
}
function repairContact() {
  return farm.settings.repairProvider === 'staff' ? 'mechanic' : 'dealer';
}
function receivesEvents(contact) {
  return farm.contactPreferences?.[contact] === true;
}
function eventContact(event) {
  return event.type === 'repair' ? repairContact() : event.contact;
}
function planMonth() {
  const count = monthlyEventCount(farm.settings);
  const pool = catalogue.filter(event => receivesEvents(eventContact(event)) && (!event.livestock || farm.settings.animals) && (!event.sheep || farm.settings.sheep) &&
    !(event.type === 'repair' && farm.incidents.some(incident => incident.type === 'repair' &&
      incident.item === event.item && incident.stage !== 'closed')));
  const senderOf = event => assignedContact(eventContact(event));
  const scheduled = [];
  const senderCounts = new Map();
  while (scheduled.length < count) {
    const available = pool.filter(event => !scheduled.includes(event) &&
      !(event.type === 'repair' && scheduled.some(item => item.type === 'repair' && item.item === event.item)));
    if (!available.length) break;
    const senders = [...new Set(available.map(senderOf))];
    const fewest = Math.min(...senders.map(sender => senderCounts.get(sender) || 0));
    const sender = choose(senders.filter(id => (senderCounts.get(id) || 0) === fewest));
    const weighted = available.filter(event => senderOf(event) === sender)
      .flatMap(event => event.season?.includes(farm.month) ? [event, event, event] : [event]);
    scheduled.push(choose(weighted));
    senderCounts.set(sender, fewest + 1);
  }
  if (farm.settings.delivery === 'staggered') {
    farm.queue = scheduled.map(event => ({ event }));
    if (farm.queue.length) farm.queue[0].dueAt = Date.now() + messageDelay();
    return;
  }
  // Spread the planned order over the farm days without putting repeat senders first.
  farm.queue = scheduled.map((event, index) => ({
    event,
    day: 1 + Math.floor(index * farm.days / scheduled.length),
  }));
}
function messageDelay() {
  return (300 + Math.floor(Math.random() * 301)) * 1000;
}
function scheduleDelivery() {
  clearTimeout(deliveryTimer);
  const eventDueAt = farm.monthClosed ? undefined : farm.queue[0]?.dueAt;
  const dueAt = Math.min(eventDueAt ?? Infinity, ...farm.pendingMessages.map(item => item.dueAt));
  if (!Number.isFinite(dueAt)) return;
  deliveryTimer = setTimeout(() => {
    const latest = readState();
    const now = Date.now();
    const ready = latest.pendingMessages.filter(item => item.dueAt <= now);
    const eventReady = !latest.monthClosed && latest.queue[0]?.dueAt <= now;
    if (!ready.length && !eventReady) return;
    farm = latest;
    // Deliver at most one queued update per contact even after a suspended tab wakes.
    const deliveryTimes = new Map();
    farm.pendingMessages = farm.pendingMessages.filter(item => {
      const previous = deliveryTimes.get(item.contact);
      if (previous !== undefined) {
        item.dueAt = previous + messageDelay();
        deliveryTimes.set(item.contact, item.dueAt);
        return true;
      }
      if (item.dueAt > now) return true;
      message(item.contact, item.text, item.extra);
      deliveryTimes.set(item.contact, now);
      return false;
    });
    for (const [contact, time] of deliveryTimes) farm.lastAutomaticMessage[contact] = time;
    if (eventReady) {
      offer(farm.queue.shift().event);
      if (farm.queue.length) farm.queue[0].dueAt = now + messageDelay();
    }
    save();
    render();
  }, Math.max(0, dueAt - Date.now()));
}

function offer(event, deliver = automaticMessage) {
  if (event.type === 'service' || isStandalonePartsOffer(event)) return;
  const role = eventContact(event);
  if (!receivesEvents(role)) return;
  const recipient = assignedContact(role);
  if (event.type === 'note' && event.text === 'I found the spare gate pin in the workshop. I’ve left it on the bench.') return;
  if (event.scenario) {
    const staff = role === 'mechanic';
    const job = { ...event, id: nextId(), contact: recipient, stage: 'offer', step: 'start',
      route: staff ? 'farm' : 'call-out' };
    farm.incidents.push(job);
    const words = {
      battery: staff
        ? `The battery’s dead. Leave the tractor exactly where it is. Shall I order a replacement for ${money(20000)}?`
        : `The battery’s dead. Leave the tractor where it is. Shall I send a fitter with a new battery for ${money(40000)} including the visit?`,
      tyre: `That tyre’s losing air slowly. Can you bring the tractor back to the ${staff && farm.settings.workshop ? 'farm workshop' : 'yard'} and let me know when it’s parked?`,
      header: staff
        ? `I’ve checked the header. There’s a fault in the drive and it needs a dealer fitter. You can take it to the dealership or I can book a visit for ${money(10000)} extra.`
        : `We need to inspect the header drive. You can bring it in or I can send a fitter for ${money(10000)} extra.`,
    };
    repairUpdate(job, words[job.scenario], undefined, deliver);
    return;
  }
  const amount = choose(event.amounts || [0]) * 100;
  const info = { photo: event.photo, guidance: event.guidance };
  const source = contactName(recipient);
  if (event.type === 'income' || event.type === 'credit') {
    addEntry(source, event.reason, amount, event.type);
    deliver(recipient, `${event.text} ${money(amount)}.`, info);
    return;
  }
  if (event.type === 'note') {
    deliver(recipient, event.text, info);
    return;
  }
  const incident = { ...event, contact: recipient, id: nextId(), amount, stage: 'offer' };
  farm.incidents.push(incident);
  if (event.type === 'repair' && event.item === 'tractor') {
    incident.onFarm = farm.settings.repairProvider === 'staff';
    incident.amount = incident.onFarm ? 10000 : 30000;
    incident.parking = farm.settings.workshop ? 'farm workshop' : 'farmyard';
    const quote = incident.onFarm
      ? `I can fix it here. The parts will be ${money(10000)}.`
      : `Workshop drop-off is ${money(30000)}, or we can come to you for ${money(40000)}.`;
    incident.replyContext = `There’s a fault on your smallest tractor. ${quote}`;
    deliver(incident.contact, incident.replyContext, { ...info, jobId: incident.id });
    return;
  }
  const quote = amount ? ` It’ll be ${money(amount)}.` : '';
  incident.replyContext = event.text + quote;
  deliver(recipient, incident.replyContext, { ...info, jobId: incident.id });
}
const repairGuidance = {
  battery: 'Leave the tractor exactly where it stopped. Use another machine until the repair is complete.',
  tyre: 'Move the tractor to the farmyard or workshop before confirming. Keep it out of use until it is fixed.',
  header: 'Keep the header out of use until the dealer confirms it is repaired.',
};

function repairUpdate(job, text, guidance = repairGuidance[job.scenario], deliver = message) {
  job.replyContext = text;
  job.guidance = guidance;
  deliver(job.contact, text, { guidance, jobId: job.id });
}

function repairTime(hour) {
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, hour)));
}

function repairDue(hours) {
  const hour = (farm.hour ?? 8) + hours;
  return farm.tick * 24 + Math.min(hour, 23);
}

function scheduleRepairStep(job, step, due) {
  job.stage = 'repairing';
  job.step = step;
  job.dueHour = due;
}

function finishRepairStep(job) {
  delete job.dueHour;
  if (job.step === 'dealer-visit') {
    job.stage = 'offer';
    job.step = 'quote';
    repairUpdate(job, `I’ve checked the header. The drive needs a replacement part. The repair is ${money(60000)} for parts and labour, separate from the visit. Shall I go ahead?`);
    return;
  }
  job.stage = job.route === 'drop-off' ? 'offer' : 'closed';
  job.step = 'collect';
  if (job.stage === 'closed') {
    job.closedMonth = monthId();
    if (selectedJobId === job.id) selectedJobId = null;
  }
  addEntry(contactName(job.contact), job.route === 'farm' ? `${job.item} repair parts` : `${job.item} repair`, job.amount);
  repairUpdate(job, job.route === 'drop-off'
    ? 'All fixed. You can collect the header from the dealership.'
    : 'All fixed. You can use the machine again.', '');
}

function renderScenarioReplies(job) {
  const staff = job.route === 'farm';
  const park = () => {
    job.stage = 'parked';
    repairUpdate(job, 'Leave it out of use for now. I’ll check back next month.');
  };
  const approve = (amount, hours) => {
    job.amount = amount;
    const due = repairDue(hours);
    scheduleRepairStep(job, 'finish', due);
    repairUpdate(job, `I’ll get the part and fit it. It should be ready by ${repairTime(due)}.`,
      'Keep the machine out of use until the repair completion message arrives.');
  };
  if (job.step === 'collect') {
    reply('I’ve collected the header', () => { job.stage = 'closed'; repairUpdate(job, 'Thanks. The header is back in use.', ''); });
    return;
  }
  if (job.scenario === 'battery') {
    const amount = staff ? 20000 : 40000;
    const hours = farm.days === 1 ? 4 : 6;
    const option = staff ? 'Order the battery' : 'Book the call-out';
    reply(`${option} · ${money(amount)} · ready by ${repairTime(repairDue(hours))}`,
      () => approve(amount, hours), 'primary');
  } else if (job.scenario === 'tyre' && job.step === 'start') {
    reply(farm.settings.workshop && staff ? 'It’s at the farm workshop' : 'It’s parked in the yard', () => {
      job.step = 'quote';
      const amount = staff ? 20000 : 40000;
      repairUpdate(job, `It needs a new tyre. I can get it fitted by ${repairTime(repairDue(2))} for ${money(amount)}${staff ? ' for the tyre' : ', including the call-out'}. Shall I go ahead?`);
    }, 'primary');
  } else if (job.scenario === 'header' && job.step === 'start') {
    const book = route => {
      job.route = route;
      job.contact = assignedContact('dealer');
      job.step = 'ready';
      repairUpdate(job, route === 'drop-off'
        ? 'Bring the header to the dealership and let me know when it’s dropped off.'
        : 'Leave the header in the yard and let me know when it’s ready for the fitter.',
        route === 'drop-off' ? 'Use a header trailer to take the header to the dealership.' : 'Park the header in the farmyard.');
    };
    reply('Take it to the dealership', () => book('drop-off'), 'primary');
    reply(`Book a dealer visit · ${money(10000)}`, () => book('call-out'));
  } else if (job.step === 'ready') {
    reply(job.route === 'drop-off' ? 'I’ve dropped it off' : 'It’s ready for the fitter', () => {
      if (job.route === 'call-out' && !job.visitCharged) {
        addEntry(contactName(job.contact), 'Header call-out and inspection', 10000);
        job.visitCharged = true;
      }
      const due = repairDue(farm.days === 1 ? 3 : 5);
      scheduleRepairStep(job, 'dealer-visit', due);
      repairUpdate(job, `I’ll inspect it and get back to you by ${repairTime(due)}.`);
    }, 'primary');
  } else {
    const amount = job.scenario === 'header' ? 60000 : staff ? 20000 : 40000;
    reply(`Approve repair · ${money(amount)}`, () => approve(amount, job.scenario === 'header' ? 4 : 2), 'primary');
  }
  reply('Leave it for now', park);
}

function runDay() {
  farm.hour = 8;
  for (const job of farm.incidents) {
    if (job.scenario && job.stage === 'repairing' && job.dueHour <= repairDue(0)) finishRepairStep(job);
  }
  for (const incident of farm.incidents) {
    if (incident.stage === 'deferred' && farm.tick >= incident.due) {
      incident.stage = 'offer';
      automaticMessage(incident.contact, 'Just checking whether you still want that service. Happy to leave it with you.');
    } else if (incident.stage === 'repairing' && farm.tick >= incident.due) {
      if (incident.delay) {
        incident.delay = false;
        incident.due += 2;
        automaticMessage(incident.contact, `Bit more to it than I thought. I’ll need another two days on the ${incident.item}. The quote still stands.`);
      } else {
        incident.stage = 'closed';
        incident.closedMonth = monthId();
        if (selectedJobId === incident.id) selectedJobId = null;
        addEntry(contactName(incident.contact), `${incident.item} repair`, incident.amount);
        automaticMessage(incident.contact, `The ${incident.item} is fixed and ready to collect. You can use it again. I’ve sent the invoice to ${contactName('accountant')}.`, { jobId: incident.id });
      }
    }
  }
  for (const item of farm.queue.filter(item => item.day === farm.day)) offer(item.event, message);
  farm.queue = farm.queue.filter(item => item.day !== farm.day);
  importRewards();
}
function beginMonth() {
  farm.started = true;
  farm.days = farm.settings.days;
  farm.day = 1;
  farm.monthClosed = false;
  planMonth();
  runDay();
}
function nextDay() {
  if (!farm.started) {
    beginMonth();
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
function remindAboutParkedRepairs() {
  for (const incident of farm.incidents) {
    if (incident.type !== 'repair' || incident.stage !== 'parked') continue;
    incident.stage = 'offer';
    if (incident.scenario) {
      const prompt = incident.scenario === 'tyre' && incident.step === 'start'
        ? 'Have you managed to get the tractor back to the yard yet? Let me know when it’s parked.'
        : `The ${incident.item} still needs attention. Can we go ahead this month?`;
      repairUpdate(incident, prompt, undefined, farm.settings.delivery === 'day' ? message : automaticMessage);
      continue;
    }
    incident.replyContext = `The ${incident.item} is still out of use. Keep it parked until it’s fixed. Shall we arrange the repair this month?`;
    automaticMessage(incident.contact, incident.replyContext);
  }
}
function nextMonth() {
  if (++farm.month === 12) {
    farm.month = 0;
    farm.year++;
  }
  farm.tick++;
  beginMonth();
  remindAboutParkedRepairs();
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
  if (farm.settings.mechanicPayroll && farm.settings.mechanicSalary > 0) {
    const annualPence = farm.settings.mechanicSalary * 100;
    const instalment = Math.floor(annualPence / 12) + (farm.month < annualPence % 12 ? 1 : 0);
    addEntry(contactName(assignedContact('mechanic')), 'Farm mechanic salary', instalment);
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
  farm.queue = [];
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

function replyTopic(incident) {
  if (incident.scenario) return { battery: 'Dead battery', tyre: 'Slow puncture', header: 'Combine header fault' }[incident.scenario];
  if (incident.type === 'repair') return incident.item + ' repair';
  return incident.reason || 'Routine service';
}
let replyThreadObserver;
function renderReplies() {
  replyThreadObserver?.disconnect();
  $('replies').replaceChildren();
  const latestIncoming = farm.messages.findLast(item => item.contact === farm.contact && !item.sent);
  if (!farm.started) {
    $('replies').append(node('p', 'Open Farm settings to match your save, then start receiving messages.'));
    return;
  }
  if (farm.contact === 'accountant') {
    if (latestIncoming) $('replies').append(node('p', latestIncoming.text, 'reply-context'));
    if (farm.day === farm.days && !farm.monthClosed) {
      if (scheduledMessagesRemaining()) {
        $('replies').append(button('Request accounts', () => {
          if (!confirmMonthClose()) return;
          closeMonth();
          save();
          render();
        }, 'primary'));
      } else {
        reply(`Can I have ${monthName()}’s accounts?`, closeMonth, 'primary');
      }
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
  const items = farm.incidents.filter(item => item.contact === farm.contact &&
    (['offer', 'drop-off'].includes(item.stage) ||
      (item.type === 'repair' && item.stage !== 'closed') ||
      (item.stage === 'closed' && item.closedMonth === monthId())));
  const incident = items.find(item => item.id === selectedJobId) ||
    (selectedJobId === null ? undefined : items.find(item => item.stage !== 'closed'));
  if (!items.length) {
    if (latestIncoming) $('replies').append(node('p', latestIncoming.text, 'reply-context'));
    $('replies').append(node('p', 'No reply needed right now.'));
    return;
  }
  if (incident) selectedJobId = incident.id;
  const contact = incident?.contact;
  const leaveParked = () => {
    incident.stage = 'parked';
    message(contact, `Keep the ${incident.item} parked. I’ll check in next month.`);
  };
  const actions = node('div', undefined, 'reply-actions');
  actions.id = 'reply-actions';
  const completed = incident?.stage === 'closed';
  for (const item of items) {
    const label = item.stage === 'closed' ? `✓ ${replyTopic(item)} · ${item.closeLabel || 'Completed'}` : replyTopic(item);
    const heading = button(label, () => {
      selectedJobId = item === incident ? null : item.id;
      renderReplies();
      $('reply-request-' + item.id).focus({ preventScroll: true });
    }, item.stage === 'closed' ? 'reply-request completed-request' : 'reply-request');
    heading.id = 'reply-request-' + item.id;
    heading.setAttribute('aria-expanded', String(item === incident));
    $('replies').append(heading);
    if (item === incident) {
      heading.setAttribute('aria-controls', actions.id);
      $('replies').append(actions);
    }
  }
  if (!incident) return;
  const visible = farm.messages.filter(entry => entry.jobId === incident.id);
  const currentText = incident.replyContext || incident.text;
  if (currentText && !visible.length) {
    visible.push({ contact: incident.contact, text: currentText });
  }
  if (visible.length) {
    const thread = node('div', undefined, 'repair-thread');
    thread.setAttribute('aria-label', 'Repair messages');
    thread.tabIndex = 0;
    const messages = visible.map(entry => {
      const bubble = node('p', undefined, entry.sent ? 'reply-context job-reply' : 'reply-context');
      const sender = entry.sent ? 'You' : contactName(entry.contact || incident.contact);
      bubble.append(node('strong', sender), node('span', ` · ${entry.text}`));
      return bubble;
    });
    thread.append(...messages);
    actions.append(thread);
    if (messages.length > 1) actions.append(node('small', 'Scroll up for earlier messages', 'repair-thread-hint'));
    const latest = messages.at(-1);
    const fitLatest = () => {
      thread.style.height = `${latest.getBoundingClientRect().height}px`;
      thread.scrollTop = thread.scrollHeight;
    };
    fitLatest();
    if (typeof ResizeObserver === 'function') {
      replyThreadObserver = new ResizeObserver(fitLatest);
      replyThreadObserver.observe(latest);
    }
  }
  if (completed || incident.stage === 'repairing' || incident.stage === 'parked') return;
  if (farm.monthClosed) {
    actions.append(node('p', `This month’s accounts are ready. Reply to ${contactName('accountant')} to open the next month.`));
    return;
  }
  if (incident.scenario) {
    if (incident.guidance && farm.settings.guidance) actions.append(node('p', incident.guidance, 'game-note'));
    renderScenarioReplies(incident);
    return;
  }
  if (incident.type === 'repair' && incident.parking) {
    if (incident.stage === 'drop-off') {
      reply('I’ve parked the tractor', () => {
        incident.stage = 'closed';
        addEntry(contactName(contact), incident.onFarm ? 'Tractor repair parts' : 'Dealer tractor repair', incident.amount);
        message(contact, `The tractor is fixed. You can use it again. I’ve sent the ${money(incident.amount)} charge to ${contactName('accountant')}.`);
      }, 'primary');
      return;
    }
    const book = (location, amount) => {
      incident.amount = amount;
      incident.stage = 'drop-off';
      incident.replyContext = `Leave the tractor at the ${location} and text me when it’s parked.`;
      message(contact, incident.replyContext);
    };
    if (incident.onFarm) {
      reply('Go ahead with the repair', () => book(incident.parking, 10000), 'primary');
    } else {
      reply('I’ll bring it to the dealership', () => book('dealership', 30000), 'primary');
      reply('Book a call-out', () => book(incident.parking, 40000));
    }
    reply('Leave it parked for now', leaveParked);
    return;
  }
  if (incident.stage === 'drop-off') {
    reply(`I’ve dropped the ${incident.item} off`, () => {
      incident.stage = 'repairing';
      incident.due = farm.tick + 2;
      incident.delay = Math.random() < .3;
      incident.replyContext = `Thanks for dropping off the ${incident.item}. I’ll start the repair now. It should take two days. I’ll let you know when it’s ready to collect.`;
      message(contact, incident.replyContext);
    }, 'primary');
    return;
  }
  if (incident.type === 'repair') {
    reply('I’ll bring it over', () => {
      incident.stage = 'drop-off';
      incident.replyContext = `I’ll keep an eye out for the ${incident.item}. Let me know once you’ve dropped it off at the workshop.`;
      message(contact, incident.replyContext, {
        guidance: `Move the ${incident.item} to your chosen workshop and leave it out of use until ${contactName(incident.contact)} texts you.`,
      });
    }, 'primary');
    reply('Leave it parked for now', leaveParked);
    return;
  }
  const service = incident.type === 'service';
  reply(service ? 'Yes, book me in' : 'Yes, please go ahead', () => {
    incident.stage = 'closed';
    addEntry(contactName(contact), incident.reason || 'Routine service', incident.amount);
    message(contact, `${service ? 'I’ve booked the routine service' : incident.reason + ' is arranged'}. I’ll put the ${money(incident.amount)} on the farm account.`);
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
  const name = contactName(farm.contact);
  const [, role] = people[farm.contact];
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
  if ($('conversation-history').open) stream.scrollTop = stream.scrollHeight;
  renderReplies();
}
$('conversation-history').addEventListener('toggle', event => {
  if (event.currentTarget.open) $('conversation').scrollTop = $('conversation').scrollHeight;
});
function renderContacts() {
  $('contacts').replaceChildren();
  const latest = new Map();
  for (const [index, item] of farm.messages.entries()) latest.set(item.contact, { item, index });
  const query = $('contact-search').value.trim().toLowerCase();
  const contacts = Object.entries(people).filter(([id]) =>
    (id === 'accountant' || Object.keys(people).some(role => assignedContact(role) === id && receivesEvents(role)) || latest.has(id) ||
      farm.incidents.some(item => item.contact === id && item.stage !== 'closed')) &&
    contactName(id).toLowerCase().startsWith(query)).sort(([a], [b]) =>
    (latest.get(b)?.index ?? -1) - (latest.get(a)?.index ?? -1));
  for (const [id, [, role]] of contacts) {
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
    label.append(node('strong', contactName(id)), node('small', preview));
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
  const jobs = farm.incidents.filter(item => item.type === 'repair' && (item.stage !== 'closed' || item.closedMonth === monthId()));
  $('no-jobs').hidden = jobs.length > 0;
  $('restrictions').replaceChildren(...jobs.map(item => {
    const status = item.stage === 'closed' ? '✓ Completed' : item.stage === 'repairing' ? (item.scenario
      ? `${item.step === 'dealer-visit' ? 'Inspection booked' : 'Repair in progress'} · ${item.dueHour < (farm.tick + 1) * 24 ? repairTime(item.dueHour) : 'next farm day'}`
      : 'Repair in progress') :
      item.scenario && item.step === 'collect' ? 'Ready to collect' :
      item.stage === 'parked' ? 'Out of use · Follow-up next month' :
      farm.monthClosed ? 'Replies reopen next month' :
      item.stage === 'drop-off' ? 'Waiting for you to park the machine' : 'Waiting for your reply';
    const row = node('div');
    const expanded = expandedJobStatus === item.id;
    const heading = button(`${replyTopic(item)} · ${status}`, () => {
      expandedJobStatus = expanded ? undefined : item.id;
      renderJobs();
      $('job-status-' + item.id).focus();
    }, item.stage === 'closed' ? 'job-link completed-request' : 'job-link');
    heading.id = 'job-status-' + item.id;
    heading.setAttribute('aria-expanded', String(expanded));
    row.append(heading);
    if (expanded) {
      const detail = node('div', undefined, 'job-status-detail');
      const update = item.stage === 'repairing'
        ? (item.step === 'dealer-visit' ? 'Still waiting for the inspection.' : 'The repair is still in progress.')
        : status;
      detail.append(node('p', update === status ? status : `${update} ${status}`));
      detail.append(button('Open conversation', () => {
        selectContact(item.contact, item.id);
        save();
        render();
        $('chat-title').focus();
      }));
      row.append(detail);
    }
    return row;
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

function confirmMonthClose() {
  return !scheduledMessagesRemaining() || window.confirm(
    'Close this month now? Any new messages still scheduled for this month will be skipped. Existing jobs and follow-ups will carry over.'
  );
}
function scheduledMessagesRemaining() {
  return farm.pendingMessages.length + (farm.queue[0]?.dueAt !== undefined ? farm.queue.length : 0);
}

function nextRepairUpdate() {
  if (farm.monthClosed) return Infinity;
  return Math.min(...farm.incidents.filter(job => job.scenario && job.stage === 'repairing' &&
    job.dueHour < (farm.tick + 1) * 24).map(job => job.dueHour));
}
$('next-repair-update').addEventListener('click', () => {
  const due = nextRepairUpdate();
  if (!Number.isFinite(due)) return;
  farm.hour = Math.max(farm.hour ?? 8, due % 24);
  for (const job of farm.incidents) {
    if (job.scenario && job.stage === 'repairing' && job.dueHour <= repairDue(0)) finishRepairStep(job);
  }
  save();
  render();
});
function render() {
  scheduleDelivery();
  renderSound();
  entryFields();
  $('accounts-icon').textContent = currencies[farm.settings.currency];
  $('staff-currency').textContent = currencies[farm.settings.currency];
  $('start-chats').hidden = farm.started;
  $('setup-farm').hidden = farm.started;
  renderJobs();
  const hasContacts = Object.keys(people).some(receivesEvents);
  $('message-setup-status').hidden = hasContacts;
  const update = $('next-repair-update');
  const next = nextRepairUpdate();
  update.hidden = !Number.isFinite(next);
  if (!update.hidden) update.textContent = `Next repair update · ${repairTime(next)}`;
  $('workspace').setAttribute('data-view', messageView);
  $('date').textContent = period();
  $('day').textContent = `Day ${farm.day} of ${farm.days}`;
  $('advance').textContent = !farm.started ? 'Start farm messages' :
    farm.day < farm.days ? `Advance to Day ${farm.day + 1}` : 'Open accountant chat';
  const desktopAdvance = $('desktop-advance');
  const endOfMonth = farm.started && farm.day === farm.days;
  $('desktop-date').textContent = `${monthName()} · ${$('day').textContent}`;
  desktopAdvance.textContent = endOfMonth ? 'Open accountant chat' :
    !farm.started ? 'Start farm messages' : 'Next day';
  renderContacts();
  renderChat();
  renderAccounts();
}

const settings = $('settings').elements;
const contactSettings = $('contact-settings-form').elements;
const contactOptions = Object.entries(people).map(([id, [, role]]) => {
  const label = node('label', undefined, 'check');
  const input = node('input');
  input.type = 'checkbox';
  label.append(input, document.createTextNode(role));
  const assignment = node('select');
  assignment.setAttribute('aria-label', `Contact for ${role}`);
  if (id !== 'accountant') label.append(assignment);
  $('contact-options').append(label);
  return [id, input, assignment];

});
const nameFields = Object.entries(people).map(([id, [name, role]]) => {
  const label = node('label');
  const caption = node('span', role);
  const input = node('input');
  input.type = 'text';
  input.maxLength = 48;
  input.placeholder = name;
  label.append(caption, input);
  if (id === 'mechanic') caption.id = 'mechanic-name-label';
  $(id === 'mechanic' ? 'mechanic-name-setting' : 'contact-names').append(label);
  return [id, input];
});
function refreshAssignments() {
  for (const [role, , assignment] of contactOptions) {
    const selected = assignment.value || role;
    assignment.replaceChildren(...nameFields.filter(([id]) => role === 'accountant' ? id === role : id !== 'accountant').map(([id, field]) =>
      new Option(field.value.trim() || people[id][0], id)));
    assignment.value = selected;
  }
}
for (const [, field] of nameFields) field.addEventListener('input', refreshAssignments);
months.forEach((month, index) => settings.start.add(new Option(month, index)));
for (let count = 1; count <= 10; count++) settings.frequency.add(new Option(count, count));
const salaryPresets = [0, 1000, 2000, 5000, 10000, 20000, 25000, 30000, 35000, 40000, 50000, 60000];
const salaryAdjustments = [['salary-down-1000', -1000], ['salary-down', -100], ['salary-up', 100], ['salary-up-1000', 1000]];
function renderSalaryPicker() {
  const symbol = currencies[settings.currency.value];
  const salary = Number(contactSettings.mechanicSalary.value);
  $('salary-currency').textContent = symbol;
  $('salary-preset').replaceChildren(new Option('Choose a salary', ''),
    ...salaryPresets.map(amount => new Option(amount === 0 ? 'No salary' : symbol + amount.toLocaleString('en-GB'), amount)));
  $('salary-preset').value = salaryPresets.includes(salary) ? String(salary) : '';
  for (const [id, step] of salaryAdjustments) {
    $(id).textContent = (step < 0 ? '−' : '+') + symbol + Math.abs(step).toLocaleString('en-GB');
  }
}
$('salary-preset').addEventListener('change', event => {
  if (event.target.value) contactSettings.mechanicSalary.value = event.target.value;
});
function updateRepairSettings() {
  const employsMechanic = contactSettings.repairProvider.value === 'staff';
  $('mechanic-name-label').textContent = employsMechanic ? 'Full-time mechanic’s name' : 'Mechanic’s name';
  $('mechanic-pay').hidden = !contactSettings.mechanicPayroll.checked;
  contactSettings.mechanicSalary.disabled = !contactSettings.mechanicPayroll.checked;
}
contactSettings.repairProvider.addEventListener('change', updateRepairSettings);
contactSettings.mechanicPayroll.addEventListener('change', updateRepairSettings);
settings.currency.addEventListener('change', renderSalaryPicker);
contactSettings.mechanicSalary.addEventListener('change', renderSalaryPicker);
for (const [id, step] of salaryAdjustments) {
  $(id).addEventListener('click', () => {
    const current = contactSettings.mechanicSalary.valueAsNumber || 0;
    contactSettings.mechanicSalary.value = Math.max(0, Math.min(1000000, Math.round(current / 100) * 100 + step));
    renderSalaryPicker();
  });
}
function updateRandomRange() {
  const random = settings.frequency.value === 'random';
  $('random-range').hidden = !random;
  settings.randomMin.disabled = !random;
  settings.randomMax.disabled = !random;
  settings.randomMax.min = settings.randomMin.valueAsNumber || 1;
}
settings.frequency.addEventListener('change', updateRandomRange);
settings.randomMin.addEventListener('input', updateRandomRange);
function loadContactSettings() {
  for (const [id, input] of contactOptions) input.checked = receivesEvents(id);
  for (const [id, input] of nameFields) input.value = farm.names?.[id] || '';
  for (const key of ['repairProvider', 'mechanicPayroll', 'mechanicSalary', 'workshop']) {
    const field = contactSettings[key];
    if (field.type === 'checkbox') field.checked = farm.settings[key];
    else field.value = farm.settings[key];
  }
  refreshAssignments();
  for (const [role, , assignment] of contactOptions) assignment.value = assignedContact(role);
  renderSalaryPicker();
  updateRepairSettings();
}
function loadSettings() {
  for (const [key, value] of Object.entries(farm.settings)) {
    const field = settings[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = value;
    else field.value = value;
  }
  loadContactSettings();
  updateRandomRange();
  settings.start.disabled = farm.started;
  $('starting-month-note').textContent = farm.started
    ? 'The starting month is fixed once this save begins.'
    : 'Choose the month you want to start in.';
}
$('settings').addEventListener('submit', event => {
  event.preventDefault();
  farm.settings = {
    ...farm.settings,
    currency: settings.currency.value, delivery: settings.delivery.value,
    start: Number(settings.start.value), days: Number(settings.days.value), frequency: settings.frequency.value,
    randomMin: settings.frequency.value === 'random' ? Number(settings.randomMin.value) : farm.settings.randomMin,
    randomMax: settings.frequency.value === 'random' ? Number(settings.randomMax.value) : farm.settings.randomMax,
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
  if (!save()) {
    $('settings-save-error').textContent = 'This browser could not save your farm settings.';
    $('settings-save-error').hidden = false;
    render();
    return;
  }
  render();
  $('save-status').textContent = 'Farm settings saved.';
  $('farm-tools').close();
});
$('advance').addEventListener('click', () => {
  const starting = !farm.started;
  if (starting) {
    const preferred = repairContact();
    selectContact(receivesEvents(preferred) ? assignedContact(preferred) : 'accountant');
  }
  nextDay();
  settings.start.disabled = true;
  if (starting || (farm.day === farm.days && farm.contact === 'accountant')) $('chat-title').focus({ preventScroll: true });
});

$('desktop-advance').addEventListener('click', () => $('advance').click());

const entry = $('entry').elements;
function entryFields() {
  const hours = entry.type.value === 'worker';
  $('hours-label').hidden = !hours;
  entry.hours.required = hours;
  if (!hours) entry.hours.value = '';
  const symbol = currencies[farm.settings.currency];
  $('amount-label').textContent = hours ? `Hourly rate (${symbol})` : `Amount (${symbol})`;
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
function showContactSettings(open) {
  $('contact-settings-form').hidden = !open;
  $('main-settings-panel').hidden = open;
  $('main-settings-footer').hidden = open;
  $('farm-tools-title').textContent = open ? 'Contact names and repairs' : 'Farm settings';
}
$('open-contact-settings').addEventListener('click', () => {
  $('contact-save-error').hidden = true;
  showContactSettings(true);
  contactOptions[0][1].focus();
});
$('cancel-contact-settings').addEventListener('click', () => {
  loadContactSettings();
  showContactSettings(false);
  $('open-contact-settings').focus();
});
$('contact-settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const previous = farm;
  farm = {
    ...farm,
    contactPreferences: Object.fromEntries(contactOptions.map(([id, input]) => [id, input.checked])),
    roleContacts: Object.fromEntries(contactOptions.map(([role, , assignment]) => [role, assignment.value])),
    names: Object.fromEntries(nameFields.map(([id, input]) => [id, input.value.trim()])),
    settings: {
      ...farm.settings,
      repairProvider: contactSettings.repairProvider.value,
      mechanicPayroll: contactSettings.mechanicPayroll.checked,
      mechanicSalary: contactSettings.mechanicPayroll.checked ? Number(contactSettings.mechanicSalary.value) : farm.settings.mechanicSalary,
      workshop: contactSettings.workshop.checked,
    },
  };
  if (!save()) {
    farm = previous;
    $('contact-save-error').hidden = false;
    return;
  }
  showContactSettings(false);
  recoverEmptyStart();
  render();
  $('open-contact-settings').focus();
});
function openFarmSettings() {
  showContactSettings(false);
  loadSettings();
  $('settings-save-error').hidden = true;
  $('farm-tools').showModal();
}
$('open-farm-tools').addEventListener('click', openFarmSettings);
$('setup-farm').addEventListener('click', openFarmSettings);
$('reset').addEventListener('click', () => {
  $('reset-dialog').returnValue = '';
  $('reset-dialog').showModal();
});
$('reset-dialog').addEventListener('close', () => {
  if ($('reset-dialog').returnValue !== 'reset') return;
  $('farm-tools').close();
  farm = fresh();
  selectedJobId = undefined;
  expandedJobStatus = undefined;
  clearTimeout(toastTimer);
  $('toast-region').replaceChildren();
  messageView = 'inbox';
  $('notify').textContent = 'Enable browser notifications';
  $('notify-status').textContent = 'Notifications are available while this page is open on supported browsers.';
  loadSettings();
  save();
  render();
});
function recoverEmptyStart() {
  if (!farm.started || farm.monthClosed || farm.tick !== 0 || farm.messages.length ||
      farm.queue.length || farm.pendingMessages.length || farm.incidents.length) return;
  beginMonth();
  save();
}
function openDemo() {
  $('app').hidden = false;
  loadSettings();
  recoverEmptyStart();
  $('notify').textContent = farm.notifications ? 'Disable browser notifications' : 'Enable browser notifications';
  importRewards();
  save();
  render();
}
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
openDemo();
