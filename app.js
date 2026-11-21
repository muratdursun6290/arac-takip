// Araç Defteri - PWA Uygulama Mantığı
// Veriler LocalStorage üzerinde güvenle saklanır, çevrimdışı çalışır.

const STORAGE_KEYS = {
  VEHICLE: 'arac_defteri_vehicle',
  EXPENSES: 'arac_defteri_expenses',
  REMINDERS: 'arac_defteri_reminders'
};

// Varsayılan Araç Bilgisi
const DEFAULT_VEHICLE = {
  plate: '34 ABC 123',
  name: 'Aracım',
  year: new Date().getFullYear(),
  fuelType: 'Dizel',
  currentKm: 0
};

// Kategori Tanımları & Emojileri
const CATEGORIES = {
  fuel: { label: 'Yakıt', emoji: '⛽', color: 'var(--cat-fuel)', bg: 'var(--cat-fuel-bg)' },
  maintenance: { label: 'Periyodik Bakım', emoji: '🔧', color: 'var(--cat-maintenance)', bg: 'var(--cat-maintenance-bg)' },
  repair: { label: 'Arıza & Onarım', emoji: '🛠️', color: 'var(--cat-repair)', bg: 'var(--cat-repair-bg)' },
  insurance: { label: 'Sigorta & Kasko', emoji: '🛡️', color: 'var(--cat-insurance)', bg: 'var(--cat-insurance-bg)' },
  inspection: { label: 'Muayene', emoji: '📋', color: 'var(--cat-inspection)', bg: 'var(--cat-inspection-bg)' },
  wash: { label: 'Yıkama & Temizlik', emoji: '🧽', color: 'var(--cat-wash)', bg: 'var(--cat-wash-bg)' },
  tax: { label: 'Vergi & Harç', emoji: '💳', color: 'var(--cat-tax)', bg: 'var(--cat-tax-bg)' },
  other: { label: 'Diğer Masraf', emoji: '📦', color: 'var(--cat-other)', bg: 'var(--cat-other-bg)' }
};

// Uygulama Durumu (State)
let state = {
  vehicle: { ...DEFAULT_VEHICLE },
  expenses: [],
  reminders: [],
  filters: {
    category: 'all',
    search: '',
    dateRange: 'all',
    sortBy: 'date_desc'
  },
  pendingDeleteAction: null,
  deferredPrompt: null
};

// --- YARDIMCI FONKSİYONLAR ---

// Para Formatı (₺ 1.250,50)
function formatCurrency(num) {
  if (isNaN(num) || num === null) return '₺ 0,00';
  return '₺ ' + Number(num).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Sayı Formatı (145.200 km)
function formatNumber(num) {
  if (isNaN(num) || num === null) return '0';
  return Number(num).toLocaleString('tr-TR');
}

// Tarih Formatı (15 Kas 2026)
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Bugünün Tarihi YYYY-MM-DD
function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Benzersiz ID Üretici
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// Toast Bildirimi
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2800);
}

// --- VERİ SAKLAMA (STORAGE) ---

function loadFromStorage() {
  try {
    const savedVehicle = localStorage.getItem(STORAGE_KEYS.VEHICLE);
    if (savedVehicle) {
      state.vehicle = JSON.parse(savedVehicle);
    } else {
      state.vehicle = { ...DEFAULT_VEHICLE };
    }

    const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    state.expenses = savedExpenses ? JSON.parse(savedExpenses) : [];

    const savedReminders = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    state.reminders = savedReminders ? JSON.parse(savedReminders) : [];

    // Eğer hiç kayıt yoksa ve ilk açılışsa örnek veri yükleme teklifi yapılabilir
    if (state.expenses.length === 0 && !localStorage.getItem('arac_initialized')) {
      loadInitialSampleData();
      localStorage.setItem('arac_initialized', 'true');
    }
  } catch (err) {
    console.error('Storage yükleme hatası:', err);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.VEHICLE, JSON.stringify(state.vehicle));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(state.reminders));
  } catch (err) {
    console.error('Storage kaydetme hatası:', err);
    showToast('Depolama hatası oluştu!');
  }
}

// --- BAŞLANGIÇ & ARAYÜZ GÜNCELLEME ---

function initApp() {
  loadFromStorage();
  setupEventListeners();
  renderAll();
  initSecurityLock();
  initNotificationSystem();
}

function renderAll() {
  renderVehicleInfo();
  renderDashboard();
  renderExpensesList();
  renderRemindersList();
}

// Araç & Plaka Bilgilerini Güncelle
function renderVehicleInfo() {
  const plateText = (state.vehicle.plate || '34 ABC 123').toUpperCase();
  document.getElementById('displayHeaderPlate').textContent = plateText;
  document.getElementById('heroPlateBadge').textContent = plateText;
  document.getElementById('displayVehicleName').textContent = state.vehicle.name || 'Aracım';
  const headerKmElem = document.getElementById('displayHeaderKm');
  if (headerKmElem) {
    headerKmElem.style.display = 'none';
  }
}

// Özet (Dashboard) Ekranı
function renderDashboard() {
  // Toplam Tutar
  const totalAmount = state.expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const heroTotalElem = document.getElementById('heroTotalAmount');
  heroTotalElem.innerHTML = `<span>₺</span>${Number(totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Bu Ayki Harcama
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthExpenses = state.expenses.filter(item => item.date && item.date.startsWith(currentYearMonth));
  const monthTotal = thisMonthExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  document.getElementById('heroMonthAmount').textContent = formatCurrency(monthTotal);

  // Yılbaşından Beri Yapılan Harcamalar
  renderYearTotal();

  // Yaklaşan En Yakın Bakım / Hatırlatıcı Kartı
  renderUpcomingReminderBadge();

  // Dashboard Son Kayıtlar
  renderDashboardRecentList();
}

// Yılbaşından Beri Yapılan Harcamalar (1 Ocak'tan Bugüne)
function renderYearTotal() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const thisYearExpenses = state.expenses.filter(item => {
    if (!item.date) return false;
    const d = new Date(item.date);
    return d.getFullYear() === currentYear;
  });
  const yearTotal = thisYearExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const elem = document.getElementById('heroYearAmount');
  if (elem) {
    elem.textContent = formatCurrency(yearTotal);
  }
}

// Tarih Farkı (Gün Olarak) Hesaplama
function getDaysDifference(targetDateStr) {
  if (!targetDateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// Yaklaşan Hatırlatıcı Uyarısı (En Yakın Tarihli Olan)
function renderUpcomingReminderBadge() {
  const alertCard = document.getElementById('upcomingReminderAlert');
  const alertTitle = document.getElementById('alertReminderTitle');
  const alertDesc = document.getElementById('alertReminderDesc');
  const alertBadge = document.getElementById('alertReminderBadge');

  if (!alertCard) return;

  if (state.reminders.length === 0) {
    alertCard.style.display = 'none';
    return;
  }

  // Henüz tamamlanmamış ve tarihi olan hatırlatıcıları sırala
  const pendingReminders = state.reminders
    .filter(rem => !rem.isCompleted && rem.targetDate)
    .map(rem => {
      return {
        ...rem,
        diffDays: getDaysDifference(rem.targetDate)
      };
    })
    .sort((a, b) => a.diffDays - b.diffDays);

  if (pendingReminders.length === 0) {
    alertCard.style.display = 'none';
    return;
  }

  // En yakın tarihli olan
  const urgent = pendingReminders[0];
  alertCard.style.display = 'flex';
  alertTitle.textContent = urgent.title;
  alertDesc.textContent = `Planlanan Tarih: ${formatDate(urgent.targetDate)}`;

  if (alertBadge) {
    alertBadge.className = 'reminder-badge';
    if (urgent.diffDays === 0) {
      alertBadge.textContent = 'Bugün!';
      alertBadge.classList.add('urgent');
    } else if (urgent.diffDays === 1) {
      alertBadge.textContent = 'Yarın! (1 Gün)';
      alertBadge.classList.add('urgent');
    } else if (urgent.diffDays === 3) {
      alertBadge.textContent = '3 Gün Kaldı';
      alertBadge.classList.add('warning');
    } else if (urgent.diffDays > 0) {
      alertBadge.textContent = `${urgent.diffDays} Gün Kaldı`;
    } else {
      alertBadge.textContent = `${Math.abs(urgent.diffDays)} Gün Gecikti`;
      alertBadge.classList.add('urgent');
    }
  }
}

// Dashboard Son Kayıtlar
function renderDashboardRecentList() {
  const container = document.getElementById('dashboardRecentList');
  const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sorted.slice(0, 20);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Henüz Kayıt Yok</div>
        <div class="empty-state-desc">İlk yakıt, bakım veya masraf kaydınızı eklemek için aşağıdaki + butonuna dokunun.</div>
      </div>
    `;
    // max-height sınırlamasını kaldır
    container.style.maxHeight = 'none';
    container.style.overflowY = 'visible';
    return;
  }

  // Önce sınırsız göster, sonra ölçüp 2 kartın yüksekliğine sabitle
  container.style.maxHeight = 'none';
  container.style.overflowY = 'visible';
  container.innerHTML = recent.map(item => createExpenseCardHtml(item)).join('');
  attachRecordActionEvents(container);

  // 2'den fazla kart varsa max-height'ı tam 2 kartı gösterecek şekilde hesapla
  if (recent.length > 2) {
    setTimeout(() => {
      const cards = container.querySelectorAll('.record-card');
      if (cards.length >= 2) {
        const h1 = Math.max(cards[0].offsetHeight, cards[0].getBoundingClientRect().height);
        const h2 = Math.max(cards[1].offsetHeight, cards[1].getBoundingClientRect().height);
        const gap = 12;
        const extraRoom = 16; // 2. kartın butonları ve alt gölgesinin tam görünmesi için pay
        const computedHeight = Math.ceil(h1 + gap + h2 + extraRoom);
        container.style.maxHeight = computedHeight + 'px';
        container.style.overflowY = 'auto';
      }
    }, 60);
  } else {
    container.style.maxHeight = 'none';
    container.style.overflowY = 'visible';
  }
}

// Tüm Giderler Listesini Filtreleyip Render Etme
function renderExpensesList() {
  const container = document.getElementById('allExpensesList');
  let list = [...state.expenses];

  // 1. Kategori Filtresi
  if (state.filters.category !== 'all') {
    list = list.filter(item => item.category === state.filters.category);
  }

  // 2. Metin Arama
  if (state.filters.search.trim()) {
    const q = state.filters.search.toLowerCase().trim();
    list = list.filter(item => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const placeMatch = (item.place || '').toLowerCase().includes(q);
      const notesMatch = (item.notes || '').toLowerCase().includes(q);
      const catMatch = (CATEGORIES[item.category]?.label || '').toLowerCase().includes(q);
      return titleMatch || placeMatch || notesMatch || catMatch;
    });
  }

  // 3. Tarih Aralığı Filtresi
  const now = new Date();
  if (state.filters.dateRange === 'this_month') {
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    list = list.filter(item => item.date && item.date.startsWith(prefix));
  } else if (state.filters.dateRange === 'last_month') {
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    list = list.filter(item => item.date && item.date.startsWith(prefix));
  } else if (state.filters.dateRange === 'this_year') {
    const yearPrefix = `${now.getFullYear()}`;
    list = list.filter(item => item.date && item.date.startsWith(yearPrefix));
  }

  // 4. Sıralama
  list.sort((a, b) => {
    switch (state.filters.sortBy) {
      case 'date_asc':
        return new Date(a.date) - new Date(b.date);
      case 'amount_desc':
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      case 'amount_asc':
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      case 'km_desc':
        return (Number(b.km) || 0) - (Number(a.km) || 0);
      case 'date_desc':
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Eşleşen Kayıt Bulunamadı</div>
        <div class="empty-state-desc">Seçili filtrelere uygun masraf veya bakım kaydı yok. Filtreleri temizleyebilirsiniz.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => createExpenseCardHtml(item)).join('');
  attachRecordActionEvents(container);
}

// Kayıt Kartı HTML Şablonu
function createExpenseCardHtml(item) {
  const cat = CATEGORIES[item.category] || CATEGORIES.other;
  const isFuel = item.category === 'fuel';

  let detailsHtml = '';
  if (isFuel && item.fuelLiters) {
    detailsHtml += `<span class="record-badge">⛽ ${item.fuelLiters} L</span>`;
    if (item.fuelPricePerLiter) {
      detailsHtml += `<span class="record-badge">${item.fuelPricePerLiter} ₺/L</span>`;
    }
  }

  if (item.place) {
    detailsHtml += `<span class="record-badge">🏢 ${escapeHtml(item.place)}</span>`;
  }

  return `
    <div class="record-card" data-id="${item.id}">
      <div class="record-card-top">
        <div class="record-type-box">
          <div class="cat-icon-badge" style="background: ${cat.bg}; color: ${cat.color};">
            ${cat.emoji}
          </div>
          <div class="record-main-info">
            <span class="record-title">${escapeHtml(item.title || cat.label)}</span>
            <span class="record-meta">${formatDate(item.date)} • ${cat.label}</span>
          </div>
        </div>
        <div class="record-price">${formatCurrency(item.amount)}</div>
      </div>

      ${detailsHtml ? `<div class="record-details-row">${detailsHtml}</div>` : ''}

      ${item.notes ? `<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">"${escapeHtml(item.notes)}"</div>` : ''}

      <div class="record-actions-row">
        <button class="action-pill-btn edit-btn" data-action="edit" data-id="${item.id}" title="Kaydı Düzelt">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          Düzelt
        </button>
        <button class="action-pill-btn delete-btn" data-action="delete" data-id="${item.id}" title="Kaydı Sil">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Sil
        </button>
      </div>
    </div>
  `;
}

// XSS Önleme
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Kart İşlem Olaylarını Bağlama (Düzenle / Sil)
function attachRecordActionEvents(container) {
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openEditExpenseModal(id);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      confirmDeleteExpense(id);
    });
  });
}

// Hatırlatıcılar Listesi
function renderRemindersList() {
  const container = document.getElementById('remindersList');
  if (state.reminders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏰</div>
        <div class="empty-state-title">Hatırlatıcı Yok</div>
        <div class="empty-state-desc">Bir sonraki yağ değişimi, periyodik bakım veya muayene tarihinizi buraya ekleyerek zamanında haberdar olun.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.reminders.map(rem => {
    const cat = CATEGORIES[rem.category] || CATEGORIES.maintenance;
    let statusText = '';
    let isUrgent = false;

    if (rem.targetDate) {
      const diffDays = getDaysDifference(rem.targetDate);
      if (diffDays === 0) {
        statusText = '🚨 Bugün bakım günü!';
        isUrgent = true;
      } else if (diffDays === 1) {
        statusText = '⚠️ Yarın! (1 gün kaldı)';
        isUrgent = true;
      } else if (diffDays === 3) {
        statusText = '🔔 3 gün kaldı • ' + formatDate(rem.targetDate);
        isUrgent = true;
      } else if (diffDays > 0) {
        statusText = `📅 ${formatDate(rem.targetDate)} (${diffDays} gün kaldı)`;
      } else {
        statusText = `⚠️ Tarihi geçti (${Math.abs(diffDays)} gün gecikti)`;
        isUrgent = true;
      }
    } else {
      statusText = 'Planlandı';
    }

    return `
      <div class="record-card" style="${isUrgent ? 'border-left: 5px solid var(--danger);' : ''}">
        <div class="record-card-top">
          <div class="record-type-box">
            <div class="cat-icon-badge" style="background: ${cat.bg}; color: ${cat.color};">
              ${cat.emoji}
            </div>
            <div class="record-main-info">
              <span class="record-title">${escapeHtml(rem.title)}</span>
              <span class="record-meta" style="${isUrgent ? 'color: var(--danger); font-weight:700;' : ''}">${statusText}</span>
            </div>
          </div>
          <span class="record-badge" style="background: ${isUrgent ? 'var(--danger-container)' : 'var(--surface-container-low)'}; color: ${isUrgent ? 'var(--danger)' : 'var(--text-main)'};">
            ${isUrgent ? 'Yaklaştı' : 'Planlandı'}
          </span>
        </div>

        ${rem.notes ? `<div style="font-size: 11px; color: var(--text-muted);">Not: ${escapeHtml(rem.notes)}</div>` : ''}

        <div class="record-actions-row">
          <button class="action-pill-btn edit-btn" data-rem-action="edit" data-id="${rem.id}" title="Hatırlatıcıyı Düzelt">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Düzelt
          </button>
          <button class="action-pill-btn delete-btn" data-rem-action="delete" data-id="${rem.id}" title="Hatırlatıcıyı Sil">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Sil
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-rem-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditReminderModal(id);
    });
  });

  container.querySelectorAll('[data-rem-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.reminders = state.reminders.filter(r => r.id !== id);
      saveToStorage();
      renderAll();
      showToast('Hatırlatıcı silindi.');
    });
  });
}

// --- KAYIT (GİDER) EKLEME & DÜZENLEME ---

function openAddExpenseModal() {
  document.getElementById('expenseModalTitle').textContent = 'Yeni Gider Kaydı';
  document.getElementById('expenseEditId').value = '';
  document.getElementById('expenseForm').reset();
  
  // Varsayılan tarih bugün
  document.getElementById('formDate').value = getTodayDateString();

  // Varsayılan kategori yakıt
  selectFormCategory('fuel');

  // En son bilinen kilometreyi forma hazır getir
  if (state.vehicle.currentKm) {
    document.getElementById('formKm').value = state.vehicle.currentKm;
  }

  openModal('expenseModal');
}

function openEditExpenseModal(id) {
  const item = state.expenses.find(x => x.id === id);
  if (!item) return;

  document.getElementById('expenseModalTitle').textContent = 'Kaydı Düzelt';
  document.getElementById('expenseEditId').value = item.id;
  document.getElementById('formAmount').value = item.amount || '';
  document.getElementById('formDate').value = item.date || getTodayDateString();
  document.getElementById('formKm').value = item.km || '';
  document.getElementById('formTitle').value = item.title || '';
  document.getElementById('formPlace').value = item.place || '';
  document.getElementById('formNotes').value = item.notes || '';

  // Kategori seç
  selectFormCategory(item.category || 'fuel');

  // Yakıt alanları
  if (item.category === 'fuel') {
    document.getElementById('formFuelLiters').value = item.fuelLiters || '';
    document.getElementById('formFuelPricePerLiter').value = item.fuelPricePerLiter || '';
    document.getElementById('formFuelIsFull').checked = item.fuelIsFull !== false;
  }

  openModal('expenseModal');
}

function handleExpenseFormSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('expenseEditId').value;
  const category = document.getElementById('formCategory').value;
  const amount = parseFloat(document.getElementById('formAmount').value) || 0;
  const date = document.getElementById('formDate').value || getTodayDateString();
  const km = parseInt(document.getElementById('formKm').value, 10) || 0;
  const title = document.getElementById('formTitle').value.trim();
  const place = document.getElementById('formPlace').value.trim();
  const notes = document.getElementById('formNotes').value.trim();

  let fuelLiters = null;
  let fuelPricePerLiter = null;
  let fuelIsFull = true;

  if (category === 'fuel') {
    fuelLiters = parseFloat(document.getElementById('formFuelLiters').value) || null;
    fuelPricePerLiter = parseFloat(document.getElementById('formFuelPricePerLiter').value) || null;
    fuelIsFull = document.getElementById('formFuelIsFull').checked;

    // Otomatik litre / tutar tamamlama
    if (amount > 0 && fuelPricePerLiter > 0 && !fuelLiters) {
      fuelLiters = parseFloat((amount / fuelPricePerLiter).toFixed(2));
    }
  }

  if (editId) {
    // DÜZELTME / GÜNCELLEME İŞLEMİ
    const index = state.expenses.findIndex(x => x.id === editId);
    if (index !== -1) {
      state.expenses[index] = {
        ...state.expenses[index],
        category,
        amount,
        date,
        km,
        title,
        place,
        notes,
        fuelLiters,
        fuelPricePerLiter,
        fuelIsFull,
        updatedAt: new Date().toISOString()
      };
      showToast('Kayıt başarıyla güncellendi.');
    }
  } else {
    // YENİ KAYIT EKLEME İŞLEMİ
    const newRecord = {
      id: generateId(),
      category,
      amount,
      date,
      km,
      title,
      place,
      notes,
      fuelLiters,
      fuelPricePerLiter,
      fuelIsFull,
      createdAt: new Date().toISOString()
    };
    state.expenses.unshift(newRecord);
    showToast('Yeni kayıt kaydedildi.');
  }

  // Eğer girilen km araç kilometremizden büyükse araç km'sini de güncelle
  if (km > (state.vehicle.currentKm || 0)) {
    state.vehicle.currentKm = km;
  }

  saveToStorage();
  closeModal('expenseModal');
  renderAll();
}

function selectFormCategory(catKey) {
  document.getElementById('formCategory').value = catKey;
  const grid = document.getElementById('formCatPicker');
  grid.querySelectorAll('.cat-picker-item').forEach(item => {
    if (item.getAttribute('data-value') === catKey) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  // Yakıt ekstra alanlarını aç/kapat
  const fuelFields = document.getElementById('fuelExtraFields');
  if (catKey === 'fuel') {
    fuelFields.style.display = 'flex';
  } else {
    fuelFields.style.display = 'none';
  }
}

// Kayıt Silme Onayı
function confirmDeleteExpense(id) {
  const item = state.expenses.find(x => x.id === id);
  if (!item) return;

  const msg = `"${item.title || 'Bu gider'}" (${formatCurrency(item.amount)}) kaydını silmek istediğinize emin misiniz?`;
  document.getElementById('confirmDeleteMessage').textContent = msg;

  state.pendingDeleteAction = () => {
    state.expenses = state.expenses.filter(x => x.id !== id);
    saveToStorage();
    renderAll();
    showToast('Kayıt silindi.');
  };

  openModal('confirmDeleteModal');
}

// --- ARAÇ VE PLAKA DÜZENLEME ---

function openVehicleModal() {
  document.getElementById('vehiclePlateInput').value = state.vehicle.plate || '';
  document.getElementById('vehicleNameInput').value = state.vehicle.name || '';
  document.getElementById('vehicleYearInput').value = state.vehicle.year || '';
  document.getElementById('vehicleFuelTypeInput').value = state.vehicle.fuelType || 'Dizel';

  openModal('vehicleModal');
}

function handleVehicleFormSubmit(e) {
  e.preventDefault();

  let plate = document.getElementById('vehiclePlateInput').value.trim().toUpperCase();
  plate = cleanPlateFormat(plate);

  state.vehicle.plate = plate || '34 ABC 123';
  state.vehicle.name = document.getElementById('vehicleNameInput').value.trim() || 'Aracım';
  state.vehicle.year = parseInt(document.getElementById('vehicleYearInput').value, 10) || new Date().getFullYear();
  state.vehicle.fuelType = document.getElementById('vehicleFuelTypeInput').value;

  saveToStorage();
  closeModal('vehicleModal');
  renderAll();
  showToast('Araç ve plaka bilgileri güncellendi.');
}

function cleanPlateFormat(str) {
  if (!str) return '';
  return str.toUpperCase().replace(/\s+/g, ' ').trim();
}

// --- HATIRLATICI EKLEME & DÜZENLEME ---

function openAddReminderModal() {
  document.getElementById('reminderForm').reset();
  document.getElementById('reminderEditId').value = '';
  document.getElementById('reminderModalTitle').textContent = 'Yeni Bakım Hatırlatıcısı';
  
  const submitBtn = document.getElementById('saveReminderBtn');
  if (submitBtn) submitBtn.textContent = 'Hatırlatıcıyı Kaydet';

  openModal('reminderModal');
}

function openEditReminderModal(id) {
  const rem = state.reminders.find(r => r.id === id);
  if (!rem) return;

  document.getElementById('reminderModalTitle').textContent = 'Hatırlatıcıyı Düzelt';
  document.getElementById('reminderEditId').value = rem.id;
  document.getElementById('reminderTitleInput').value = rem.title || '';
  document.getElementById('reminderCategoryInput').value = rem.category || 'maintenance';
  document.getElementById('reminderTargetDateInput').value = rem.targetDate || '';
  document.getElementById('reminderNotesInput').value = rem.notes || '';

  const submitBtn = document.getElementById('saveReminderBtn');
  if (submitBtn) submitBtn.textContent = 'Güncelle';

  openModal('reminderModal');
}

function handleReminderFormSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('reminderEditId').value;
  const title = document.getElementById('reminderTitleInput').value.trim();
  const category = document.getElementById('reminderCategoryInput').value;
  const targetDate = document.getElementById('reminderTargetDateInput').value || null;
  const notes = document.getElementById('reminderNotesInput').value.trim();

  if (editId) {
    // DÜZELTME / GÜNCELLEME İŞLEMİ
    const index = state.reminders.findIndex(r => r.id === editId);
    if (index !== -1) {
      state.reminders[index] = {
        ...state.reminders[index],
        title,
        category,
        targetDate,
        notes,
        updatedAt: new Date().toISOString()
      };
      showToast('Hatırlatıcı başarıyla güncellendi.');
    }
  } else {
    // YENİ HATIRLATICI EKLEME
    const newRem = {
      id: generateId(),
      title,
      category,
      targetDate,
      notes,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    state.reminders.push(newRem);
    showToast('Hatırlatıcı kaydedildi.');
  }

  saveToStorage();
  closeModal('reminderModal');
  renderAll();
  checkReminderNotifications();
}

// --- YEDEKLEME VE GERİ YÜKLEME (BACKUP & RESTORE) ---

// JSON Yedek İndir (Telefonun Hafızasına)
function exportBackupJson() {
  const backupData = {
    app: 'Araç Defteri PWA',
    version: '1.0',
    exportDate: new Date().toISOString(),
    vehicle: state.vehicle,
    expenses: state.expenses,
    reminders: state.reminders
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const cleanPlate = (state.vehicle.plate || 'arac').replace(/\s+/g, '_');
  const filename = `arac_defteri_yedek_${cleanPlate}_${getTodayDateString()}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Yedek dosyanız indirildi!');
}

// JSON Yedek Yükle (Telefondan Dosya Seçip Geri Getirme)
function importBackupJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data || (!data.expenses && !data.vehicle)) {
        throw new Error('Geçersiz yedek dosyası formatı!');
      }

      const count = (data.expenses || []).length;
      const confirmMsg = `Yedek dosyasında ${count} adet harcama kaydı ve araç bilgileri bulundu.\n\nMevcut verilerinizin yerine yüklensin mi?`;

      if (confirm(confirmMsg)) {
        if (data.vehicle) state.vehicle = data.vehicle;
        if (Array.isArray(data.expenses)) state.expenses = data.expenses;
        if (Array.isArray(data.reminders)) state.reminders = data.reminders;

        saveToStorage();
        renderAll();
        showToast(`Yedek başarıyla yüklendi! (${count} kayıt)`);
      }
    } catch (err) {
      alert('Yedek dosyası okunamadı: ' + err.message);
    }
    // Dosya inputunu sıfırla ki aynı dosya tekrar seçilebilsin
    event.target.value = '';
  };
  reader.readAsText(file);
}

// PDF Olarak Dışa Aktarma (.pdf)
function exportPdf() {
  if (state.expenses.length === 0) {
    showToast('Dışa aktarılacak masraf kaydı yok!');
    return;
  }

  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF oluşturucu yüklenemedi. Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const plate = (state.vehicle.plate || '34 ABC 123').toUpperCase();
    const vehicleName = state.vehicle.name || 'Aracım';
    const vehicleKm = formatNumber(state.vehicle.currentKm || 0) + ' km';
    const totalAmount = state.expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Üst Başlık Banner (Material You Teal #006a6a)
    doc.setFillColor(0, 106, 106);
    doc.rect(0, 0, 210, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ARAC DEFTERI - GIDER VE BAKIM RAPORU', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapor Tarihi: ${formatDate(getTodayDateString())} | Olusturuldu: arac-takip`, 14, 19);

    // Araç Bilgi Kartı Özeti
    doc.setTextColor(22, 29, 29);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Plaka: ${plate}`, 14, 34);
    doc.text(`Arac: ${vehicleName}`, 80, 34);

    doc.setDrawColor(200, 223, 223);
    doc.line(14, 37, 196, 37);

    // Toplam İstatistikler
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Toplam Harcama: ${formatCurrency(totalAmount)}  |  Toplam Kayit: ${state.expenses.length} adet`, 14, 43);

    // Tablo Satırları Hazırlığı
    const tableData = state.expenses.map(item => {
      const cat = CATEGORIES[item.category]?.label || item.category;
      let fuelInfo = '-';
      if (item.category === 'fuel' && item.fuelLiters) {
        fuelInfo = `${item.fuelLiters} L` + (item.fuelPricePerLiter ? ` (${item.fuelPricePerLiter} TL)` : '');
      }
      return [
        formatDate(item.date),
        cat,
        item.title || '-',
        fuelInfo,
        item.place || '-',
        Number(item.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
      ];
    });

    // AutoTable ile profesyonel tablo
    doc.autoTable({
      startY: 48,
      head: [['Tarih', 'Kategori', 'Baslik / Aciklama', 'Yakit / Detay', 'Servis / Istasyon', 'Tutar']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 106, 106],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 24 },
        2: { cellWidth: 42 },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 26 },
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [244, 250, 249]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data) {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Sayfa ${data.pageNumber} / ${pageCount} - Arac Defteri PWA`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 8,
          { align: 'center' }
        );
      }
    });

    const cleanPlate = (plate || 'arac').replace(/\s+/g, '_');
    const filename = `arac_harcamalari_${cleanPlate}_${getTodayDateString()}.pdf`;

    doc.save(filename);
    showToast('PDF raporu başarıyla indirildi!');
  } catch (err) {
    console.error('PDF üretme hatası:', err);
    showToast('PDF oluşturulurken hata: ' + err.message);
  }
}

// CSV / Excel Dışa Aktarma
function exportCsv() {
  if (state.expenses.length === 0) {
    showToast('Dışa aktarılacak kayıt yok!');
    return;
  }

  // UTF-8 BOM ekleyerek Excel'in Türkçe karakterleri düzgün açmasını sağlıyoruz
  let csvContent = '\uFEFF';
  csvContent += 'Tarih;Kategori;Başlık;Tutar (TL);Kilometre;Yakıt Litre;Litre Fiyatı;İstasyon/Servis;Notlar\n';

  state.expenses.forEach(item => {
    const catLabel = CATEGORIES[item.category]?.label || item.category;
    const row = [
      item.date || '',
      catLabel,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      item.amount ? item.amount.toFixed(2) : '0.00',
      item.km || '',
      item.fuelLiters || '',
      item.fuelPricePerLiter || '',
      `"${(item.place || '').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(';') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arac_harcamalari_${getTodayDateString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Excel/CSV dosyası indirildi!');
}

// Test / Örnek Veri Yükleme
function loadInitialSampleData() {
  state.vehicle = {
    plate: '34 DEF 567',
    name: 'Toyota Corolla 1.6',
    year: 2022,
    fuelType: 'Benzin',
    currentKm: 48500
  };

  state.expenses = [
    {
      id: generateId(),
      category: 'fuel',
      amount: 1750.00,
      date: getTodayDateString(),
      km: 48500,
      title: 'Opet Benzin Dolumu',
      place: 'Opet Kadıköy',
      fuelLiters: 38.5,
      fuelPricePerLiter: 45.45,
      fuelIsFull: true,
      notes: 'Tam depo yapıldı.',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      category: 'maintenance',
      amount: 4200.00,
      date: '2026-10-20',
      km: 45000,
      title: '45.000 Km Periyodik Bakım',
      place: 'Toyota Yetkili Servis',
      notes: 'Motor yağı, yağ filtresi, polen ve hava filtresi değişti.',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      category: 'wash',
      amount: 250.00,
      date: '2026-10-15',
      km: 44600,
      title: 'Detaylı İç-Dış Yıkama',
      place: 'Hızlı Yıkama',
      notes: '',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      category: 'insurance',
      amount: 8500.00,
      date: '2026-09-01',
      km: 43000,
      title: 'Genişletilmiş Kasko & Trafik Sigortası',
      place: 'Anadolu Sigorta',
      notes: 'Poliçe no: 48192019',
      createdAt: new Date().toISOString()
    }
  ];

  state.reminders = [
    {
      id: generateId(),
      title: '60.000 Km Yağ & Filtre Bakımı',
      category: 'maintenance',
      targetKm: 60000,
      targetDate: '2027-04-15',
      notes: 'Buji kontrolü ve balata değişimi yapılacak.',
      isCompleted: false,
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      title: 'TÜVTÜRK Araç Muayenesi',
      category: 'inspection',
      targetKm: null,
      targetDate: '2027-08-10',
      notes: 'Randevu almayı unutma.',
      isCompleted: false,
      createdAt: new Date().toISOString()
    }
  ];

  saveToStorage();
}

function resetAllData() {
  if (confirm('DİKKAT: Cihazdaki tüm araç, gider ve hatırlatıcı kayıtları silinecek!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) {
    localStorage.removeItem(STORAGE_KEYS.VEHICLE);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.REMINDERS);

    state.vehicle = { ...DEFAULT_VEHICLE };
    state.expenses = [];
    state.reminders = [];

    saveToStorage();
    renderAll();
    showToast('Tüm veriler temizlendi.');
  }
}

// --- MODAL AÇ/KAPA VE OLAYLAR ---

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Sekmeler Arası Geçiş (Tab Switching)
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navItem) navItem.classList.add('active');

  // Sayfa başına kaydır
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Event Dinleyicilerini Kurma
function setupEventListeners() {
  // Alt Gezinme Çubuğu Sekmeleri
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // FAB Butonu: Yeni Kayıt Ekle
  document.getElementById('openAddExpenseFab').addEventListener('click', openAddExpenseModal);

  // Üst Plaka Butonu: Araç Değiştir
  document.getElementById('headerPlateBtn').addEventListener('click', openVehicleModal);
  document.getElementById('openSettingsHeaderBtn').addEventListener('click', () => switchTab('tabSettings'));
  document.getElementById('quickBackupBtn').addEventListener('click', exportBackupJson);

  // Dashboard Butonları
  document.getElementById('seeAllExpensesBtn').addEventListener('click', () => switchTab('tabExpenses'));
  document.getElementById('upcomingReminderAlert').addEventListener('click', () => switchTab('tabReminders'));

  // Kayıt Modalı Kapatma
  document.getElementById('closeExpenseModalBtn').addEventListener('click', () => closeModal('expenseModal'));
  document.getElementById('cancelExpenseBtn').addEventListener('click', () => closeModal('expenseModal'));
  document.getElementById('expenseForm').addEventListener('submit', handleExpenseFormSubmit);

  // Kategori Seçici (Form İçi)
  document.querySelectorAll('.cat-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.getAttribute('data-value');
      selectFormCategory(val);
    });
  });

  // Yakıt Litre / Tutar Otomatik Çarpım/Bölüm Hesabı
  const formAmount = document.getElementById('formAmount');
  const formFuelLiters = document.getElementById('formFuelLiters');
  const formFuelPrice = document.getElementById('formFuelPricePerLiter');

  formFuelLiters.addEventListener('input', () => {
    const liters = parseFloat(formFuelLiters.value) || 0;
    const price = parseFloat(formFuelPrice.value) || 0;
    if (liters > 0 && price > 0 && (!formAmount.value || document.activeElement === formFuelLiters)) {
      formAmount.value = (liters * price).toFixed(2);
    }
  });

  formFuelPrice.addEventListener('input', () => {
    const liters = parseFloat(formFuelLiters.value) || 0;
    const price = parseFloat(formFuelPrice.value) || 0;
    if (liters > 0 && price > 0) {
      formAmount.value = (liters * price).toFixed(2);
    }
  });

  // Araç Modalı
  document.getElementById('editVehicleSettingsBtn').addEventListener('click', openVehicleModal);
  document.getElementById('closeVehicleModalBtn').addEventListener('click', () => closeModal('vehicleModal'));
  document.getElementById('cancelVehicleBtn').addEventListener('click', () => closeModal('vehicleModal'));
  document.getElementById('vehicleForm').addEventListener('submit', handleVehicleFormSubmit);

  // Hatırlatıcı Modalı
  document.getElementById('openAddReminderBtn').addEventListener('click', openAddReminderModal);
  document.getElementById('closeReminderModalBtn').addEventListener('click', () => closeModal('reminderModal'));
  document.getElementById('cancelReminderBtn').addEventListener('click', () => closeModal('reminderModal'));
  document.getElementById('reminderForm').addEventListener('submit', handleReminderFormSubmit);

  // Silme Onay Modalı
  document.getElementById('closeConfirmDeleteBtn').addEventListener('click', () => closeModal('confirmDeleteModal'));
  document.getElementById('cancelDeleteActionBtn').addEventListener('click', () => closeModal('confirmDeleteModal'));
  document.getElementById('approveDeleteActionBtn').addEventListener('click', () => {
    if (state.pendingDeleteAction) {
      state.pendingDeleteAction();
      state.pendingDeleteAction = null;
    }
    closeModal('confirmDeleteModal');
  });

  // Filtreler & Arama (Giderler Tab)
  document.getElementById('expenseSearchInput').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderExpensesList();
  });

  document.querySelectorAll('#categoryChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.category = chip.getAttribute('data-category');
      renderExpensesList();
    });
  });

  document.getElementById('dateFilterSelect').addEventListener('change', (e) => {
    state.filters.dateRange = e.target.value;
    renderExpensesList();
  });

  document.getElementById('sortFilterSelect').addEventListener('change', (e) => {
    state.filters.sortBy = e.target.value;
    renderExpensesList();
  });

  // Ayarlar Tabı İşlemleri
  document.getElementById('exportBackupJsonBtn').addEventListener('click', exportBackupJson);
  document.getElementById('importBackupFileInput').addEventListener('change', importBackupJson);
  
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportPdf);
  
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

  document.getElementById('loadSampleDataBtn').addEventListener('click', () => {
    if (confirm('Örnek veriler yüklensin mi?')) {
      loadInitialSampleData();
      renderAll();
      showToast('Örnek veriler yüklendi!');
    }
  });

  document.getElementById('resetAllDataBtn').addEventListener('click', resetAllData);

  // Kilit ve Güvenlik Ayar Butonları
  const setupPinBtn = document.getElementById('setupPinBtn');
  if (setupPinBtn) setupPinBtn.addEventListener('click', openSetPinModal);

  const closeSetPinModalBtn = document.getElementById('closeSetPinModalBtn');
  if (closeSetPinModalBtn) closeSetPinModalBtn.addEventListener('click', () => closeModal('setPinModal'));

  const cancelSetPinBtn = document.getElementById('cancelSetPinBtn');
  if (cancelSetPinBtn) cancelSetPinBtn.addEventListener('click', () => closeModal('setPinModal'));

  const setPinForm = document.getElementById('setPinForm');
  if (setPinForm) setPinForm.addEventListener('submit', handleSetPinFormSubmit);

  const removeLockBtn = document.getElementById('removeLockBtn');
  if (removeLockBtn) removeLockBtn.addEventListener('click', handleRemoveLock);

  const toggleBiometricBtn = document.getElementById('toggleBiometricBtn');
  if (toggleBiometricBtn) toggleBiometricBtn.addEventListener('click', handleToggleBiometric);

  // Bildirim İzni Butonu
  const requestNotifPermBtn = document.getElementById('requestNotifPermBtn');
  if (requestNotifPermBtn) requestNotifPermBtn.addEventListener('click', handleNotificationBtnClick);

  // Kilit Ekranı Keypad Tuşları
  document.querySelectorAll('.keypad-key[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      handleKeypadInput(val);
    });
  });

  const lockBackspaceBtn = document.getElementById('lockBackspaceBtn');
  if (lockBackspaceBtn) lockBackspaceBtn.addEventListener('click', handleKeypadBackspace);

  const lockBioBtn = document.getElementById('lockBioBtn');
  if (lockBioBtn) lockBioBtn.addEventListener('click', authenticateWithBiometric);

  const lockDirectBioBtn = document.getElementById('lockDirectBioBtn');
  if (lockDirectBioBtn) lockDirectBioBtn.addEventListener('click', authenticateWithBiometric);

  // Modal dışına dokunulduğunda kapatma
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });

  // PWA Kurulum Promptu (Android Chrome)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.style.display = 'flex';
  });

  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('PWA Kurulumu kabul edildi.');
        }
        state.deferredPrompt = null;
        document.getElementById('pwaInstallBanner').style.display = 'none';
      }
    });
  }
}

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', initApp);

// ==========================================================
// GÜVENLİK, KİLİT, PIN VE BİYOMETRİK (PARMAK İZİ) SİSTEMİ
// ==========================================================

let enteredPin = '';
let isBiometricSupported = false;

// Kilit Sistemini Başlatma
async function initSecurityLock() {
  isBiometricSupported = await checkBiometricSupport();

  // Biyometrik desteği varsa Ayarlar'daki butonu ve modal onay kutusunu göster
  const toggleBioBtn = document.getElementById('toggleBiometricBtn');
  const bioContainer = document.getElementById('biometricCheckboxContainer');
  const lockBioBtn = document.getElementById('lockBioBtn');
  const lockBioQuickRow = document.getElementById('lockBioQuickRow');

  if (isBiometricSupported) {
    if (toggleBioBtn) toggleBioBtn.style.display = 'flex';
    if (bioContainer) bioContainer.style.display = 'block';
    if (lockBioBtn) lockBioBtn.style.display = 'flex';
    if (lockBioQuickRow) lockBioQuickRow.style.display = 'block';
  } else {
    if (toggleBioBtn) toggleBioBtn.style.display = 'none';
    if (bioContainer) bioContainer.style.display = 'none';
    if (lockBioBtn) lockBioBtn.style.visibility = 'hidden';
    if (lockBioQuickRow) lockBioQuickRow.style.display = 'none';
  }

  updateSecurityUi();

  // Kilit Aktif mi?
  const isLockActive = localStorage.getItem('arac_defteri_lock_active') === 'true';
  const hasPin = !!localStorage.getItem('arac_defteri_pin_hash');

  if (isLockActive && hasPin) {
    showLockScreen();
    // Parmak izi aktifse otomatik olarak okutma istemini başlat
    const isBioActive = localStorage.getItem('arac_defteri_biometric_enabled') === 'true';
    if (isBioActive && isBiometricSupported) {
      setTimeout(() => {
        authenticateWithBiometric();
      }, 350);
    }
  } else {
    hideLockScreen();
  }
}

// Biyometrik / Parmak İzi Donanım Desteği Kontrolü
async function checkBiometricSupport() {
  try {
    if (window.PublicKeyCredential && 
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!available;
    }
  } catch (e) {
    console.warn('Biometric support check error:', e);
  }
  return false;
}

// Güvenlik Arayüzünü Güncelleme
function updateSecurityUi() {
  const isLockActive = localStorage.getItem('arac_defteri_lock_active') === 'true';
  const hasPin = !!localStorage.getItem('arac_defteri_pin_hash');
  const isBioActive = localStorage.getItem('arac_defteri_biometric_enabled') === 'true';

  const lockDesc = document.getElementById('lockStatusDesc');
  const setupPinBtnText = document.getElementById('setupPinBtnText');
  const removeLockBtn = document.getElementById('removeLockBtn');
  const bioStateTag = document.getElementById('biometricStateTag');

  if (lockDesc) {
    if (isLockActive && hasPin) {
      lockDesc.textContent = isBioActive ? 'Parola Koruması: Aktif (PIN + Parmak İzi)' : 'Parola Koruması: Aktif (PIN Korunuyor)';
      lockDesc.style.color = '#137333';
    } else {
      lockDesc.textContent = 'Parola Koruması: Kapalı';
      lockDesc.style.color = 'var(--text-muted)';
    }
  }

  if (setupPinBtnText) {
    setupPinBtnText.textContent = (isLockActive && hasPin) ? '🔑 PIN Kodunu Değiştir' : '🔑 Parola (PIN) Belirle';
  }

  if (removeLockBtn) {
    removeLockBtn.style.display = (isLockActive && hasPin) ? 'flex' : 'none';
  }

  if (bioStateTag) {
    bioStateTag.textContent = isBioActive ? 'Açık' : 'Kapalı';
    bioStateTag.style.color = isBioActive ? 'var(--primary)' : 'var(--text-dim)';
  }
}

// Kilit Ekranını Açma
function showLockScreen() {
  const lockScreen = document.getElementById('appLockScreen');
  if (!lockScreen) return;
  
  const plateText = (state.vehicle.plate || '34 ABC 123').toUpperCase();
  const lockPlate = document.getElementById('lockPlateDisplay');
  if (lockPlate) lockPlate.textContent = plateText;

  enteredPin = '';
  updatePinDots();
  hideLockError();

  lockScreen.style.display = 'flex';
}

// Kilit Ekranını Kapatma (Uygulama Açıldı)
function hideLockScreen() {
  const lockScreen = document.getElementById('appLockScreen');
  if (lockScreen) {
    lockScreen.style.display = 'none';
  }
}

// PIN Tuş Girişi
function handleKeypadInput(digit) {
  if (enteredPin.length >= 4) return;
  enteredPin += digit;
  updatePinDots();
  hideLockError();

  if (enteredPin.length === 4) {
    setTimeout(verifyEnteredPin, 100);
  }
}

// PIN Geri Silme
function handleKeypadBackspace() {
  if (enteredPin.length > 0) {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
    hideLockError();
  }
}

// PIN Noktalarını Güncelle
function updatePinDots() {
  const dots = document.querySelectorAll('#lockPinDots .pin-dot');
  dots.forEach((dot, index) => {
    if (index < enteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

// Hata Gösterimi
function showLockError(msg) {
  const errorElem = document.getElementById('lockErrorMsg');
  if (errorElem) {
    errorElem.textContent = msg || 'Hatalı PIN kodu! Tekrar deneyin.';
    errorElem.style.visibility = 'visible';
    errorElem.classList.add('shake');
    setTimeout(() => {
      errorElem.classList.remove('shake');
    }, 400);
  }
  enteredPin = '';
  updatePinDots();
}

function hideLockError() {
  const errorElem = document.getElementById('lockErrorMsg');
  if (errorElem) {
    errorElem.style.visibility = 'hidden';
  }
}

// SHA-256 PIN Hash Fonksiyonu
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_arac_defteri_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// PIN Doğrulama
async function verifyEnteredPin() {
  const savedHash = localStorage.getItem('arac_defteri_pin_hash');
  if (!savedHash) {
    unlockApp();
    return;
  }

  const currentHash = await hashPin(enteredPin);
  if (currentHash === savedHash) {
    unlockApp();
    showToast('Giriş başarılı! Hoş geldiniz.');
  } else {
    showLockError('Hatalı PIN kodu! Lütfen tekrar deneyin.');
  }
}

// Kilidi Aç ve İçeri Al
function unlockApp() {
  hideLockScreen();
  enteredPin = '';
  updatePinDots();
  checkReminderNotifications();
}

// Biyometrik (Parmak İzi) Kaydı
async function registerBiometricCredential() {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const createOptions = {
      publicKey: {
        challenge,
        rp: { name: "Araç Defteri" },
        user: {
          id: userId,
          name: "surucu@aracdefteri",
          displayName: "Araç Sahibi"
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000
      }
    };

    const cred = await navigator.credentials.create(createOptions);
    if (cred && cred.rawId) {
      const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem('arac_defteri_credential_id', rawIdBase64);
      localStorage.setItem('arac_defteri_biometric_enabled', 'true');
      return true;
    }
  } catch (err) {
    console.warn('Parmak izi kayıt hatası:', err);
  }
  return false;
}

// Biyometrik (Parmak İzi) ile Doğrulama & Giriş
async function authenticateWithBiometric() {
  if (!isBiometricSupported) {
    showToast('Bu cihazda parmak izi okuyucu desteklenmiyor.');
    return;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credIdBase64 = localStorage.getItem('arac_defteri_credential_id');
    const getOptions = {
      publicKey: {
        challenge,
        userVerification: "required",
        timeout: 60000
      }
    };

    if (credIdBase64) {
      const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
      getOptions.publicKey.allowCredentials = [{
        id: rawId,
        type: 'public-key'
      }];
    }

    const assertion = await navigator.credentials.get(getOptions);
    if (assertion) {
      unlockApp();
      showToast('Parmak izi ile giriş yapıldı! 👆');
    }
  } catch (err) {
    console.log('Parmak izi okuma iptal veya başarısız:', err);
  }
}

// PIN Belirleme Modalı Aç
function openSetPinModal() {
  document.getElementById('setPinForm').reset();
  openModal('setPinModal');
}

// PIN Belirleme Form Submit
async function handleSetPinFormSubmit(e) {
  e.preventDefault();

  const newPin = document.getElementById('newPinInput').value.trim();
  const confirmPin = document.getElementById('confirmPinInput').value.trim();
  const enableBio = document.getElementById('enableBiometricCheckbox').checked;

  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    alert('Lütfen 4 basamaklı rakamlardan oluşan bir PIN kodu girin.');
    return;
  }

  if (newPin !== confirmPin) {
    alert('Girdiğiniz PIN kodları birbiriyle uyuşmuyor! Lütfen kontrol edin.');
    return;
  }

  const hashed = await hashPin(newPin);
  localStorage.setItem('arac_defteri_pin_hash', hashed);
  localStorage.setItem('arac_defteri_lock_active', 'true');

  if (enableBio && isBiometricSupported) {
    const bioSuccess = await registerBiometricCredential();
    if (bioSuccess) {
      showToast('PIN kodu ve Parmak İzi başarıyla kaydedildi! 🔒');
    } else {
      showToast('PIN kaydedildi (Parmak izi eşleştirilemedi veya iptal edildi).');
    }
  } else {
    showToast('Güvenlik PIN kodu başarıyla kaydedildi! 🔒');
  }

  closeModal('setPinModal');
  updateSecurityUi();
}

// Parola Korumasını Kaldırma
function handleRemoveLock() {
  if (confirm('Uygulama parola korumasını kaldırmak istediğinizden emin misiniz?')) {
    localStorage.removeItem('arac_defteri_pin_hash');
    localStorage.setItem('arac_defteri_lock_active', 'false');
    localStorage.setItem('arac_defteri_biometric_enabled', 'false');
    localStorage.removeItem('arac_defteri_credential_id');
    updateSecurityUi();
    showToast('Parola koruması kaldırıldı.');
  }
}

// Parmak İzi Açma / Kapatma Toggle
async function handleToggleBiometric() {
  const isBioActive = localStorage.getItem('arac_defteri_biometric_enabled') === 'true';
  if (isBioActive) {
    localStorage.setItem('arac_defteri_biometric_enabled', 'false');
    updateSecurityUi();
    showToast('Parmak izi ile giriş kapatıldı.');
  } else {
    if (!localStorage.getItem('arac_defteri_pin_hash')) {
      alert('Parmak izini aktif etmek için önce bir PIN kodu belirlemelisiniz.');
      openSetPinModal();
      return;
    }
    const success = await registerBiometricCredential();
    if (success) {
      localStorage.setItem('arac_defteri_biometric_enabled', 'true');
      updateSecurityUi();
      showToast('Parmak izi ile giriş başarıyla açıldı! 👆');
    } else {
      showToast('Parmak izi okutma işlemi tamamlanamadı.');
    }
  }
}


// ==========================================================
// BİLDİRİM SİSTEMİ (3 GÜN & 1 GÜN KALA BİLDİRİM GÖNDERME)
// ==========================================================

function initNotificationSystem() {
  updateNotificationUi();
  checkReminderNotifications();
}

// Bildirim Arayüzünü Güncelle
function updateNotificationUi() {
  const permBtn = document.getElementById('requestNotifPermBtn');
  const permStatus = document.getElementById('notifPermStatus');
  const permText = document.getElementById('notifPermBtnText');

  if (!permBtn || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    if (permStatus) {
      permStatus.textContent = 'Açık (İzin Verildi)';
      permStatus.style.color = '#137333';
    }
    if (permText) permText.textContent = '🔔 Bildirimleri Test Et';
  } else if (Notification.permission === 'denied') {
    if (permStatus) {
      permStatus.textContent = 'Engellendi';
      permStatus.style.color = 'var(--danger)';
    }
    if (permText) permText.textContent = '🔔 Bildirim İzni Ver';
  } else {
    if (permStatus) {
      permStatus.textContent = 'İzin Ver';
      permStatus.style.color = 'var(--primary)';
    }
    if (permText) permText.textContent = '🔔 Bildirim İznini Etkinleştir';
  }
}

// Bildirim İzni İste veya Test Bildirimi Gönder
async function handleNotificationBtnClick() {
  if (!('Notification' in window)) {
    showToast('Cihazınızda bildirim özelliği desteklenmiyor.');
    return;
  }

  if (Notification.permission === 'granted') {
    sendSystemNotification('Araç Defteri Test Bildirimi 🔔', {
      body: 'Bildirimler sorunsuz çalışıyor! Bakımlarınıza 3 gün ve 1 gün kala bildirim alacaksınız.'
    });
    showToast('Test bildirimi gönderildi!');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    updateNotificationUi();
    if (perm === 'granted') {
      sendSystemNotification('Araç Defteri Bildirimleri Aktif! 🚗', {
        body: 'Planlanan periyodik bakım ve hatırlatmalarınıza 3 gün ve 1 gün kala haber verilecektir.'
      });
      showToast('Bildirimler başarıyla açıldı! 🔔');
      checkReminderNotifications();
    } else {
      showToast('Bildirim izni verilmedi.');
    }
  } catch (err) {
    console.warn('Bildirim izni hatası:', err);
  }
}

// Sistem Bildirimi Gönder (Service Worker veya Notification API)
function sendSystemNotification(title, options = {}) {
  const defaultOpts = {
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200]
  };
  const finalOpts = { ...defaultOpts, ...options };

  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, finalOpts);
      }).catch(() => {
        try { new Notification(title, finalOpts); } catch(e){}
      });
    } else {
      try { new Notification(title, finalOpts); } catch(e){}
    }
  }
}

// Hatırlatıcı Bildirim Kontrolü (3 Gün & 1 Gün Kala)
function checkReminderNotifications() {
  if (!state.reminders || state.reminders.length === 0) return;
  const todayStr = getTodayDateString();

  state.reminders.forEach(rem => {
    if (rem.isCompleted || !rem.targetDate) return;
    const diffDays = getDaysDifference(rem.targetDate);

    // 3 Gün Kala
    if (diffDays === 3) {
      const key = `notif_${rem.id}_3days_${rem.targetDate}`;
      if (!localStorage.getItem(key)) {
        sendSystemNotification(`📅 3 Gün Kaldı: ${rem.title}`, {
          body: `Planlanan bakım / işlem tarihi: ${formatDate(rem.targetDate)}. Kontrol etmeyi unutmayın!`
        });
        showToast(`🔔 "${rem.title}" için 3 gün kaldı!`, 'warning');
        localStorage.setItem(key, todayStr);
      }
    }

    // 1 Gün Kala (Yarın)
    if (diffDays === 1) {
      const key = `notif_${rem.id}_1day_${rem.targetDate}`;
      if (!localStorage.getItem(key)) {
        sendSystemNotification(`🚨 Yarın: ${rem.title}`, {
          body: `Dikkat! Planlanan bakım / işlem tarihi yarın (${formatDate(rem.targetDate)})!`
        });
        showToast(`🚨 Dikkat: "${rem.title}" yarın!`, 'danger');
        localStorage.setItem(key, todayStr);
      }
    }

    // Bugün
    if (diffDays === 0) {
      const key = `notif_${rem.id}_0day_${rem.targetDate}`;
      if (!localStorage.getItem(key)) {
        sendSystemNotification(`📢 Bugün: ${rem.title}`, {
          body: `Planlanan bakım / işlem gününüz geldi!`
        });
        showToast(`📢 Bugün: "${rem.title}"!`, 'info');
        localStorage.setItem(key, todayStr);
      }
    }
  });
}
