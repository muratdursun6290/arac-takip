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
  document.getElementById('displayHeaderKm').textContent = formatNumber(state.vehicle.currentKm || 0) + ' km';
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

  // Ortalama Yakıt Tüketimi
  renderFuelAverage();

  // Yaklaşan Hatırlatıcı Uyarısı
  renderUpcomingReminderBadge();

  // Dashboard Son 5 Kayıt
  renderDashboardRecentList();
}

// Yakıt Tüketimi Hesaplama (L/100km veya ₺/km)
function renderFuelAverage() {
  const fuelRecords = state.expenses
    .filter(item => item.category === 'fuel' && item.km > 0)
    .sort((a, b) => a.km - b.km);

  const fuelAvgElem = document.getElementById('heroFuelAvg');

  if (fuelRecords.length >= 2) {
    const first = fuelRecords[0];
    const last = fuelRecords[fuelRecords.length - 1];
    const kmDiff = last.km - first.km;

    if (kmDiff > 0) {
      // Toplam yakıt masrafı (ilk alım hariç veya son alınanlara göre)
      const totalFuelCost = fuelRecords.slice(1).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalLiters = fuelRecords.slice(1).reduce((sum, item) => sum + (Number(item.fuelLiters) || 0), 0);

      const costPerKm = totalFuelCost / kmDiff;
      if (totalLiters > 0) {
        const litersPer100 = (totalLiters / kmDiff) * 100;
        fuelAvgElem.textContent = `${litersPer100.toFixed(1)} L/100km (${costPerKm.toFixed(2)} ₺/km)`;
      } else {
        fuelAvgElem.textContent = `${costPerKm.toFixed(2)} ₺/km`;
      }
      return;
    }
  }

  fuelAvgElem.textContent = '-';
}

// Yaklaşan Hatırlatıcı Uyarısı
function renderUpcomingReminderBadge() {
  const alertCard = document.getElementById('upcomingReminderAlert');
  const alertTitle = document.getElementById('alertReminderTitle');
  const alertDesc = document.getElementById('alertReminderDesc');

  if (state.reminders.length === 0) {
    alertCard.style.display = 'none';
    return;
  }

  const currentKm = Number(state.vehicle.currentKm) || 0;
  const today = getTodayDateString();

  // En acil olanı bul (km veya tarih olarak)
  let urgentReminder = null;
  let minDiffKm = Infinity;

  for (const rem of state.reminders) {
    if (rem.isCompleted) continue;
    let diffKm = rem.targetKm ? (rem.targetKm - currentKm) : Infinity;
    if (diffKm < minDiffKm) {
      minDiffKm = diffKm;
      urgentReminder = rem;
    }
  }

  if (urgentReminder) {
    alertCard.style.display = 'flex';
    alertTitle.textContent = urgentReminder.title;
    if (urgentReminder.targetKm) {
      const remainingKm = urgentReminder.targetKm - currentKm;
      if (remainingKm <= 0) {
        alertDesc.textContent = `⚠️ Bakım kilometresi ${Math.abs(remainingKm)} km aşıldı!`;
        alertDesc.style.color = 'var(--danger)';
      } else {
        alertDesc.textContent = `Hedef: ${formatNumber(urgentReminder.targetKm)} km (${formatNumber(remainingKm)} km kaldı)`;
        alertDesc.style.color = 'var(--text-muted)';
      }
    } else if (urgentReminder.targetDate) {
      alertDesc.textContent = `Hedef Tarih: ${formatDate(urgentReminder.targetDate)}`;
    }
  } else {
    alertCard.style.display = 'none';
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
    return;
  }

  container.innerHTML = recent.map(item => createExpenseCardHtml(item)).join('');
  attachRecordActionEvents(container);
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

  if (item.km) {
    detailsHtml += `<span class="record-badge">📍 ${formatNumber(item.km)} km</span>`;
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

  const currentKm = Number(state.vehicle.currentKm) || 0;

  container.innerHTML = state.reminders.map(rem => {
    const cat = CATEGORIES[rem.category] || CATEGORIES.maintenance;
    let statusText = '';
    let isUrgent = false;

    if (rem.targetKm) {
      const remainingKm = rem.targetKm - currentKm;
      if (remainingKm <= 0) {
        statusText = `⚠️ Kilometresi aşıldı (${Math.abs(remainingKm)} km geçti)`;
        isUrgent = true;
      } else {
        statusText = `${formatNumber(remainingKm)} km kaldı (Hedef: ${formatNumber(rem.targetKm)} km)`;
      }
    } else if (rem.targetDate) {
      statusText = `Hedef: ${formatDate(rem.targetDate)}`;
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
            ${isUrgent ? 'Acil' : 'Planlandı'}
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
  document.getElementById('vehicleCurrentKmInput').value = state.vehicle.currentKm || '';

  openModal('vehicleModal');
}

function handleVehicleFormSubmit(e) {
  e.preventDefault();

  let plate = document.getElementById('vehiclePlateInput').value.trim().toUpperCase();
  // Boşlukları düzenle (Örn: 34ABC123 -> 34 ABC 123)
  plate = cleanPlateFormat(plate);

  state.vehicle.plate = plate || '34 ABC 123';
  state.vehicle.name = document.getElementById('vehicleNameInput').value.trim() || 'Aracım';
  state.vehicle.year = parseInt(document.getElementById('vehicleYearInput').value, 10) || new Date().getFullYear();
  state.vehicle.fuelType = document.getElementById('vehicleFuelTypeInput').value;
  state.vehicle.currentKm = parseInt(document.getElementById('vehicleCurrentKmInput').value, 10) || 0;

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

  // Güncel km'nin 10.000 fazlasını öner
  const nextKm = (Number(state.vehicle.currentKm) || 0) + 10000;
  if (nextKm > 10000) {
    document.getElementById('reminderTargetKmInput').value = nextKm;
  }
  openModal('reminderModal');
}

function openEditReminderModal(id) {
  const rem = state.reminders.find(r => r.id === id);
  if (!rem) return;

  document.getElementById('reminderModalTitle').textContent = 'Hatırlatıcıyı Düzelt';
  document.getElementById('reminderEditId').value = rem.id;
  document.getElementById('reminderTitleInput').value = rem.title || '';
  document.getElementById('reminderCategoryInput').value = rem.category || 'maintenance';
  document.getElementById('reminderTargetKmInput').value = rem.targetKm || '';
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
  const targetKm = parseInt(document.getElementById('reminderTargetKmInput').value, 10) || null;
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
        targetKm,
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
      targetKm,
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
    doc.text(`Arac: ${vehicleName}`, 70, 34);
    doc.text(`Guncel Km: ${vehicleKm}`, 145, 34);

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
        item.km ? formatNumber(item.km) + ' km' : '-',
        fuelInfo,
        item.place || '-',
        Number(item.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
      ];
    });

    // AutoTable ile profesyonel tablo
    doc.autoTable({
      startY: 48,
      head: [['Tarih', 'Kategori', 'Baslik / Aciklama', 'Kilometre', 'Yakit', 'Servis / Istasyon', 'Tutar']],
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
