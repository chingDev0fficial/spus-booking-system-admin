// API Configuration
const API_URL =
  "https://script.google.com/macros/s/AKfycbxdkklPteUg-U0YP0YPorOU6cwTKnMGuNj9TW-BD9mw1BYVecwG96inpf29GZ4zo-dK/exec";
const libraryAPI =
  "https://script.google.com/macros/s/AKfycbzCaWbdybQRv1bC_dGP_8kQdEsaIK8WlxZArQwGue1dX2rw0Mus0HDVTC5BuziwJhmveg/exec";
const facilityAPI =
  "https://script.google.com/macros/s/AKfycbzGMYKtuKrYu6IzYHoAfA46domoRl6MjCNgUDJtrT2OFjHnfo0eB5TVmtk3jUEqJ0UWFQ/exec";
const resourcesAPI =
  "https://script.google.com/macros/s/AKfycbzBn1LabXAKnX8NjPUn1OrH5RSPyoHeGPIIW3WgPJ_-6rHW30XIeAWxKdTtxwJjLupp/exec";

// Global variables
let allBookings = [];
let filteredBookings = [];
let allResources = [];
let filteredResources = [];
let charts = {};
let libraries = {};
let facilities = {};
let currentSection = "overview";
let autoRefreshInterval = null;
let lastUpdateTime = null;
let isAutoRefreshEnabled = false;

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", async function () {
  await initializeDashboard();
  setupNavigation();

  // Set initial update time
  lastUpdateTime = new Date();
  updateLastUpdateDisplay();

  // Start auto-refresh
  startAutoRefresh();

  // Update "last updated" display every 30 seconds
  setInterval(updateLastUpdateDisplay, 30000);
});

// Initialize Dashboard - Load all data
async function initializeDashboard() {
  showLoading(true);

  try {
    // Load libraries and facilities first
    await Promise.all([loadLibraries(), loadFacilities()]);

    // Then load bookings
    await loadDashboardData();

    // Populate library filter dropdown
    populateLibraryFilter();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
    showError("Error loading dashboard. Please refresh the page.");
    showLoading(false);
  }
}

// Load Libraries
async function loadLibraries() {
  try {
    const response = await fetch(libraryAPI);
    if (!response.ok) {
      throw new Error("Failed to fetch libraries");
    }

    const data = await response.json();
    console.log("Libraries API Response:", data);

    let librariesData = [];
    if (data.status === "success" && data.data) {
      librariesData = Array.isArray(data.data) ? data.data : [data.data];
    } else if (Array.isArray(data)) {
      librariesData = data;
    }

    // Create library lookup object
    libraries = {};
    librariesData.forEach((lib) => {
      const id = lib.id || lib.library_id;
      const name = lib.name || lib.library_name;
      if (id && name) {
        libraries[id] = name;
      }
    });

    console.log("Libraries loaded:", libraries);
  } catch (error) {
    console.error("Error loading libraries:", error);
    // Continue even if libraries fail to load
  }
}

// Load Facilities
async function loadFacilities() {
  try {
    const response = await fetch(facilityAPI);
    if (!response.ok) {
      throw new Error("Failed to fetch facilities");
    }

    const data = await response.json();
    console.log("Facilities API Response:", data);

    let facilitiesData = [];
    if (data.status === "success" && data.data) {
      facilitiesData = Array.isArray(data.data) ? data.data : [data.data];
    } else if (Array.isArray(data)) {
      facilitiesData = data;
    }

    // Create facility lookup object
    facilities = {};
    facilitiesData.forEach((fac) => {
      const id = fac.id || fac.facility_id;
      const name = fac.name || fac.facility_name;
      if (id && name) {
        facilities[id] = name;
      }
    });

    console.log("Facilities loaded:", facilities);
  } catch (error) {
    console.error("Error loading facilities:", error);
    // Continue even if facilities fail to load
  }
}

// Populate Library Filter Dropdown
function populateLibraryFilter() {
  const filterLibrary = document.getElementById("filterLibrary");

  // Clear existing options except "All Libraries"
  filterLibrary.innerHTML = '<option value="">All Libraries</option>';

  // Add libraries from loaded data
  Object.keys(libraries)
    .sort()
    .forEach((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = libraries[id];
      filterLibrary.appendChild(option);
    });
}

// Get Library Name
function getLibraryName(libraryId) {
  if (!libraryId) return "N/A";
  return libraries[libraryId] || `Library ${libraryId}`;
}

// Get Facility Name
function getFacilityName(facilityId) {
  if (!facilityId) return "N/A";
  return facilities[facilityId] || `Facility ${facilityId}`;
}

// Format Time to Human Readable Format
function formatTime(timeString) {
  if (!timeString) return "N/A";

  try {
    // Check if it's already a time format with AM/PM
    if (typeof timeString === "string") {
      // If already has AM/PM (e.g., "8:00:00 AM" or "8:00 AM")
      if (/AM|PM/i.test(timeString)) {
        // Remove seconds if present (8:00:00 AM -> 8:00 AM)
        return timeString.replace(
          /(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)/i,
          "$1:$2 $3"
        );
      }

      // Match simple time format HH:MM
      if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        const [hoursStr, minutesStr] = timeString.split(":");
        let hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        // Convert to 12-hour format
        const period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12

        // Format minutes with leading zero
        const minutesFormatted = minutes.toString().padStart(2, "0");

        return `${hours}:${minutesFormatted} ${period}`;
      }
    }

    // Handle ISO date format (1899-12-30T01:04:35.000Z)
    // This is Excel's serial date format being exported as ISO
    if (
      typeof timeString === "string" &&
      timeString.includes("T") &&
      timeString.includes("Z")
    ) {
      const date = new Date(timeString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timeString;
      }

      // For Excel time-only values (1899-12-30), extract the time portion
      // Use local hours instead of UTC since Excel stores time as local
      let hours = date.getUTCHours() + 8; // Adjust for Philippine timezone (UTC+8)
      if (hours >= 24) hours -= 24;
      const minutes = date.getUTCMinutes();

      // Convert to 12-hour format
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12

      // Format minutes with leading zero
      const minutesStr = minutes.toString().padStart(2, "0");

      return `${hours}:${minutesStr} ${period}`;
    }

    return timeString;
  } catch (error) {
    console.error("Error formatting time:", error);
    return timeString;
  }
}

// Load Dashboard Data from Google Sheets API
async function loadDashboardData() {
  try {
    // Fetch bookings from Google Sheets
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Failed to fetch bookings");
    }

    const data = await response.json();

    console.log("API Response:", data); // Debug log

    // Handle different response formats
    let bookingsData = [];

    if (data.status === "success" && data.data) {
      // Format 1: {status: 'success', data: [...]}
      bookingsData = Array.isArray(data.data) ? data.data : [data.data];
    } else if (Array.isArray(data)) {
      // Format 2: Direct array
      bookingsData = data;
    } else if (data.bookings && Array.isArray(data.bookings)) {
      // Format 3: {bookings: [...]}
      bookingsData = data.bookings;
    } else {
      console.error("Unexpected data format:", data);
      showError("Invalid data format received from server");
      showLoading(false);
      return;
    }

    // Transform data to ensure consistent property names
    allBookings = bookingsData.map((booking) => ({
      id: booking.id || booking.ID,
      booked_reference: booking.booked_reference || booking.booking_reference,
      booking_name: booking.booking_name,
      booker_type: booking.booker_type,
      email: booking.email,
      num_users: booking.num_users,
      name_users: booking.name_users,
      subject_topic_purpose: booking.subject_topic_purpose,
      teacher_coordinator: booking.teacher_coordinator,
      library: booking.library,
      facility: booking.facility,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status || "Pending",
      in: booking.in,
      timestamp: booking.timestamp,
      booked_hour: booking.booked_hour || booking.hour || 0,
    }));

    console.log("Processed bookings:", allBookings); // Debug log
    console.log("Total bookings loaded:", allBookings.length); // Debug log

    filteredBookings = [...allBookings];

    // Update dashboard with real data
    updateStats();
    initializeCharts();
    populateBookingsTable();

    showLoading(false);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showError("Error connecting to the server. Please refresh the page.");
    showLoading(false);
  }
}

// Auto-Refresh Functions
function startAutoRefresh() {
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  isAutoRefreshEnabled = true;

  // Auto-refresh every 30 seconds
  autoRefreshInterval = setInterval(async () => {
    console.log("Auto-refreshing data...");

    // Update status indicator to show refreshing
    const statusIndicator = document.getElementById("status-indicator");
    if (statusIndicator) {
      statusIndicator.style.color = "#f39c12"; // Orange while loading
    }

    await loadDashboardData();
    await loadLibraries();
    await loadFacilities();

    // Update last update time
    lastUpdateTime = new Date();
    updateLastUpdateDisplay();

    // Reset status indicator to green
    if (statusIndicator) {
      statusIndicator.style.color = "#27ae60"; // Green when done
    }
  }, 30000); // 30 seconds

  // Update UI
  updateAutoRefreshUI();
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }

  isAutoRefreshEnabled = false;

  // Update UI
  updateAutoRefreshUI();

  // Update status indicator
  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator) {
    statusIndicator.style.color = "#95a5a6"; // Gray when paused
  }
}

function toggleAutoRefresh() {
  if (isAutoRefreshEnabled) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
}

function updateAutoRefreshUI() {
  const statusText = document.getElementById("auto-refresh-status");
  const toggleBtn = document.getElementById("toggle-refresh-btn");

  if (statusText) {
    statusText.textContent = isAutoRefreshEnabled ? "ON" : "OFF";
    statusText.style.color = isAutoRefreshEnabled ? "#27ae60" : "#e74c3c";
  }

  if (toggleBtn) {
    toggleBtn.innerHTML = isAutoRefreshEnabled
      ? '<i class="fas fa-pause"></i> Pause'
      : '<i class="fas fa-play"></i> Resume';
  }
}

function updateLastUpdateDisplay() {
  const lastUpdateElement = document.getElementById("last-update");

  if (lastUpdateElement && lastUpdateTime) {
    const now = new Date();
    const diffSeconds = Math.floor((now - lastUpdateTime) / 1000);

    let timeText;
    if (diffSeconds < 60) {
      timeText = "Just now";
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      timeText = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      timeText = `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }

    lastUpdateElement.textContent = `Last updated: ${timeText}`;
  }
}

// Manual Refresh Function
async function refreshData() {
  console.log("Manual refresh triggered");

  // Disable button during refresh
  const manualRefreshBtn = document.getElementById("manual-refresh-btn");
  if (manualRefreshBtn) {
    manualRefreshBtn.disabled = true;
    manualRefreshBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
  }

  // Update status indicator
  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator) {
    statusIndicator.style.color = "#f39c12"; // Orange while loading
  }

  try {
    await loadDashboardData();
    await loadLibraries();
    await loadFacilities();

    // Update last update time
    lastUpdateTime = new Date();
    updateLastUpdateDisplay();

    // Show success indicator
    if (statusIndicator) {
      statusIndicator.style.color = "#27ae60"; // Green when done
    }

    // Show success message
    showSuccess("Dashboard refreshed successfully!");
  } catch (error) {
    console.error("Error refreshing data:", error);
    showError("Error refreshing data. Please try again.");

    if (statusIndicator) {
      statusIndicator.style.color = "#e74c3c"; // Red on error
    }
  } finally {
    // Re-enable button
    if (manualRefreshBtn) {
      manualRefreshBtn.disabled = false;
      manualRefreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
  }
}

// Show Success Message
function showSuccess(message) {
  const existingSuccess = document.getElementById("success-message");
  if (existingSuccess) {
    existingSuccess.remove();
  }

  const successDiv = document.createElement("div");
  successDiv.id = "success-message";
  successDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: #27ae60;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
            `;
  successDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <strong style="margin-left: 10px;">${message}</strong>
            `;

  document.body.appendChild(successDiv);

  setTimeout(() => {
    successDiv.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => successDiv.remove(), 300);
  }, 3000);
}

// Show error message
function showError(message) {
  const dashboardContent = document.getElementById("dashboard-content");
  dashboardContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 64px; color: #e74c3c; margin-bottom: 20px;"></i>
                    <h3 style="color: #555; margin-bottom: 10px;">Error Loading Data</h3>
                    <p style="color: #777;">${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;">
                        <i class="fas fa-refresh"></i> Reload Page
                    </button>
                </div>
            `;
}

// Show/Hide Loading
function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
  document.getElementById("dashboard-content").style.display = show
    ? "none"
    : "block";
}

// Update Statistics
function updateStats() {
  const total = filteredBookings.length;
  const completed = filteredBookings.filter(
    (b) => b.status && b.status.toLowerCase() === "completed"
  ).length;
  const pending = filteredBookings.filter(
    (b) => !b.status || b.status.toLowerCase() === "pending"
  ).length;
  const cancelled = filteredBookings.filter(
    (b) => b.status && b.status.toLowerCase() === "cancelled"
  ).length;
  const uniqueUsers = new Set(
    filteredBookings.filter((b) => b.email).map((b) => b.email)
  ).size;
  const totalHours = filteredBookings.reduce((sum, b) => {
    const hours = parseInt(b.booked_hour) || 0;
    console.log("Hours:", hours);
    return sum + hours;
  }, 0);

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-cancelled").textContent = cancelled;
  document.getElementById("stat-users").textContent = uniqueUsers;
  document.getElementById("stat-hours").textContent = totalHours;

  // Calculate approval rate
  const completedRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
  document.getElementById(
    "stat-completed-change"
  ).innerHTML = `<i class="fas fa-chart-line"></i> ${completedRate}% completed rate`;

  // Calculate rejection rate
  const cancelledRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : 0;
  document.getElementById(
    "stat-cancelled-change"
  ).innerHTML = `<i class="fas fa-arrow-down"></i> ${cancelledRate}% cancelled rate`;

  // Calculate average hours
  console.log("Total:", total);
  console.log("Total Hours:", totalHours);
  const avgHours = total > 0 ? (totalHours / total).toFixed(1) : 0;
  console.log("Avg Hours:", avgHours);
  document.getElementById(
    "stat-hours-change"
  ).textContent = `Avg ${avgHours} hrs/booking`;
}

// Initialize Charts
function initializeCharts() {
  initBookingsTrendChart();
  initStatusChart();
  initLibraryChart();
  initPeakHoursChart();
  initBookerTypeChart();
  initMonthlyChart();
}

// Bookings Trend Chart
function initBookingsTrendChart() {
  const ctx = document.getElementById("bookingsTrendChart");
  if (charts.bookingsTrend) charts.bookingsTrend.destroy();

  // Group bookings by date
  const bookingsByDate = {};
  filteredBookings.forEach((booking) => {
    if (booking.date) {
      const date = booking.date;
      bookingsByDate[date] = (bookingsByDate[date] || 0) + 1;
    }
  });

  const rawDates = Object.keys(bookingsByDate).sort();
  const dates = rawDates.map((dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  });
  const counts = rawDates.map((date) => bookingsByDate[date]);

  charts.bookingsTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Bookings",
          data: counts,
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Status Chart
function initStatusChart() {
  const ctx = document.getElementById("statusChart");
  if (charts.status) charts.status.destroy();

  const statusCounts = {};
  filteredBookings.forEach((booking) => {
    const status = booking.status || "Pending";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  charts.status = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(statusCounts),
      datasets: [
        {
          data: Object.values(statusCounts),
          backgroundColor: ["#f39c12", "#27ae60", "#e74c3c", "#3498db"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Library Chart
function initLibraryChart() {
  const ctx = document.getElementById("libraryChart");
  if (charts.library) charts.library.destroy();

  const libraryCounts = {};
  filteredBookings.forEach((booking) => {
    if (booking.library) {
      const libraryName = getLibraryName(booking.library);
      libraryCounts[libraryName] = (libraryCounts[libraryName] || 0) + 1;
    }
  });

  charts.library = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(libraryCounts),
      datasets: [
        {
          label: "Bookings",
          data: Object.values(libraryCounts),
          backgroundColor: "#3498db",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function formatTime(time) {
  let h = 0,
    m = 0;

  const d = new Date(time);
  h = d.getHours();
  m = d.getMinutes();

  // Convert to 12-hour format
  const period = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  hour12 = hour12 ? hour12 : 12;

  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

// Peak Hours Chart
function initPeakHoursChart() {
  const ctx = document.getElementById("peakHoursChart");
  if (charts.peakHours) charts.peakHours.destroy();

  const hourCounts = {};
  filteredBookings.forEach((booking) => {
    if (booking.start_time) {
      const readable = formatTime(booking.start_time);
      hourCounts[readable] = (hourCounts[readable] || 0) + 1;
    }
  });

  charts.peakHours = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(hourCounts).sort(),
      datasets: [
        {
          label: "Bookings",
          data: Object.keys(hourCounts)
            .sort()
            .map((h) => hourCounts[h]),
          backgroundColor: "#27ae60",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Booker Type Chart
function initBookerTypeChart() {
  const ctx = document.getElementById("bookerTypeChart");
  if (charts.bookerType) charts.bookerType.destroy();

  const typeCounts = {};
  filteredBookings.forEach((booking) => {
    const type = booking.booker_type || "";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  // Format labels properly
  const formattedLabels = Object.keys(typeCounts).map((t) => {
    if (t.toLowerCase() === "student") return "Student";
    if (t.toLowerCase() === "faculty") return "Faculty";
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  charts.bookerType = new Chart(ctx, {
    type: "pie",
    data: {
      labels: formattedLabels,
      datasets: [
        {
          data: Object.values(typeCounts),
          backgroundColor: ["#3498db", "#9b59b6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Monthly Chart
function initMonthlyChart() {
  const ctx = document.getElementById("monthlyChart");
  if (charts.monthly) charts.monthly.destroy();

  const monthCounts = {};
  filteredBookings.forEach((booking) => {
    if (booking.date) {
      try {
        const date = new Date(booking.date);
        if (!isNaN(date.getTime())) {
          const month = date.toLocaleString("default", {
            month: "short",
            year: "numeric",
          });
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
      } catch (e) {
        console.warn("Invalid date:", booking.date);
      }
    }
  });

  charts.monthly = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(monthCounts),
      datasets: [
        {
          label: "Bookings",
          data: Object.values(monthCounts),
          backgroundColor: "#9b59b6",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Populate Bookings Table
function populateBookingsTable() {
  const tbody = document.getElementById("bookingsTableBody");
  tbody.innerHTML = "";

  if (filteredBookings.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px;">
                            <div class="empty-state">
                                <i class="fas fa-inbox"></i>
                                <h3>No bookings found</h3>
                                <p>Try adjusting your filters</p>
                            </div>
                        </td>
                    </tr>
                `;
    return;
  }

  filteredBookings.slice(0, 50).forEach((booking) => {
    const statusClass = (booking.status || "pending").toLowerCase();
    const bookerType = booking.booker_type || "N/A";
    const libraryName = getLibraryName(booking.library);
    const startTime = formatTime(booking.start_time);
    const endTime = formatTime(booking.end_time);
    const timeRange =
      startTime && endTime && startTime !== "N/A" && endTime !== "N/A"
        ? `${startTime} - ${endTime}`
        : "N/A";
    const hours = booking.booked_hour || 0;

    const row = `
                    <tr>
                        <td>${booking.booked_reference || "N/A"}</td>
                        <td>${booking.booking_name || "N/A"}</td>
                        <td>${bookerType}</td>
                        <td>${libraryName}</td>
                        <td>${formatDate(booking.date)}</td>
                        <td>${timeRange}</td>
                        <td><span class="status-badge status-${statusClass}">${
      booking.status || "Pending"
    }</span></td>
                        <td>${hours}h</td>
                    </tr>
                `;
    tbody.innerHTML += row;
  });
}

// Apply Filters
function applyFilters() {
  const library = document.getElementById("filterLibrary").value;
  const dateRange = document.getElementById("filterDateRange").value;
  const status = document.getElementById("filterStatus").value;
  const bookerType = document.getElementById("filterBookerType").value;

  filteredBookings = allBookings.filter((booking) => {
    // Library filter
    if (library && booking.library && booking.library.toString() !== library)
      return false;

    // Status filter (case-insensitive)
    if (
      status &&
      booking.status &&
      booking.status.toLowerCase() !== status.toLowerCase()
    )
      return false;

    // Booker type filter (case-insensitive)
    if (
      bookerType &&
      booking.booker_type &&
      booking.booker_type.toLowerCase() !== bookerType.toLowerCase()
    )
      return false;

    // Date range filter
    if (dateRange !== "custom") {
      const bookingDate = new Date(booking.date);
      const today = new Date();

      switch (dateRange) {
        case "today":
          if (bookingDate.toDateString() !== today.toDateString()) return false;
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (bookingDate < weekAgo) return false;
          break;
        case "month":
          const monthAgo = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            today.getDate()
          );
          if (bookingDate < monthAgo) return false;
          break;
        case "year":
          const yearAgo = new Date(
            today.getFullYear() - 1,
            today.getMonth(),
            today.getDate()
          );
          if (bookingDate < yearAgo) return false;
          break;
      }
    }

    return true;
  });

  updateStats();
  initializeCharts();
  populateBookingsTable();
}

// Reset Filters
function resetFilters() {
  document.getElementById("filterLibrary").value = "";
  document.getElementById("filterDateRange").value = "month";
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterBookerType").value = "";
  filteredBookings = [...allBookings];
  applyFilters();
}

// Search Bookings
function searchBookings() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();

  if (!searchTerm) {
    applyFilters(); // Reset to filtered view
    return;
  }

  filteredBookings = allBookings.filter((booking) => {
    const reference = (booking.booked_reference || "").toLowerCase();
    const name = (booking.booking_name || "").toLowerCase();
    const email = (booking.email || "").toLowerCase();
    const purpose = (booking.subject_topic_purpose || "").toLowerCase();
    const users = (booking.name_users || "").toLowerCase();

    return (
      reference.includes(searchTerm) ||
      name.includes(searchTerm) ||
      email.includes(searchTerm) ||
      purpose.includes(searchTerm) ||
      users.includes(searchTerm)
    );
  });

  updateStats();
  populateBookingsTable();
}

// Setup Navigation
function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      const section = this.dataset.section;
      switchSection(section);
    });
  });
}

// Switch Section
function switchSection(section) {
  // Update title
  updateSectionTitle(section);

  // Hide all sections
  document
    .querySelectorAll(".dashboard-section")
    .forEach((s) => (s.style.display = "none"));

  // Show selected section
  const sectionElement = document.getElementById(`section-${section}`);
  if (sectionElement) {
    sectionElement.style.display = "block";
  }

  // Load section-specific data
  switch (section) {
    case "overview":
      // Already loaded
      break;
    case "bookings":
      loadAllBookingsSection();
      break;
    case "libraries":
      loadLibrariesSection();
      break;
    case "monthly":
      loadMonthlySection();
      break;
    case "analytics":
      loadAnalyticsSection();
      break;
    case "users":
      loadUsersSection();
      break;
    case "resources":
      loadResourcesSection();
      break;
  }
}

// Update Section Title
function updateSectionTitle(section) {
  const titles = {
    overview: "Dashboard Overview",
    bookings: "All Bookings Management",
    libraries: "Libraries Report",
    monthly: "Monthly Report",
    analytics: "Advanced Analytics",
    users: "User Statistics",
    resources: "Resource Management",
  };

  const subtitles = {
    overview: "Monitor your library booking system",
    bookings: "View and manage all bookings",
    libraries: "Library-specific performance metrics",
    monthly: "Monthly trends and comparisons",
    analytics: "Deep dive into booking patterns",
    users: "User behavior and statistics",
    resources: "Resource usage and availability",
  };

  document.getElementById("section-title").textContent =
    titles[section] || "Dashboard";
  document.getElementById("section-subtitle").textContent =
    subtitles[section] || "";
}

// ========== ALL BOOKINGS SECTION ==========
function loadAllBookingsSection() {
  populateAllBookingsTable(filteredBookings);
}

function populateAllBookingsTable(bookings) {
  const tbody = document.getElementById("allBookingsTableBody");
  tbody.innerHTML = "";

  if (bookings.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 40px;">
                            <div class="empty-state">
                                <i class="fas fa-inbox"></i>
                                <h3>No bookings found</h3>
                                <p>Try adjusting your filters</p>
                            </div>
                        </td>
                    </tr>
                `;
    return;
  }

  bookings.forEach((booking) => {
    const statusClass = (booking.status || "pending").toLowerCase();
    const startTime = formatTime(booking.start_time);
    const endTime = formatTime(booking.end_time);
    const timeRange =
      startTime && endTime && startTime !== "N/A" && endTime !== "N/A"
        ? `${startTime} - ${endTime}`
        : "N/A";

    const row = `
                    <tr>
                        <td>${booking.id || "N/A"}</td>
                        <td>${booking.booked_reference || "N/A"}</td>
                        <td>${booking.booking_name || "N/A"}</td>
                        <td>${booking.booker_type || "N/A"}</td>
                        <td>${booking.email || "N/A"}</td>
                        <td>${getLibraryName(booking.library)}</td>
                        <td>${getFacilityName(booking.facility)}</td>
                        <td>${formatDate(booking.date)}</td>
                        <td>${timeRange}</td>
                        <td><span class="status-badge status-${statusClass}">${
      booking.status || "Pending"
    }</span></td>
                    </tr>
                `;
    tbody.innerHTML += row;
  });
}

function searchAllBookings() {
  const searchTerm = document
    .getElementById("searchInputAll")
    .value.toLowerCase();

  if (!searchTerm) {
    populateAllBookingsTable(filteredBookings);
    return;
  }

  const filtered = filteredBookings.filter((booking) => {
    return (
      (booking.booked_reference || "").toLowerCase().includes(searchTerm) ||
      (booking.booking_name || "").toLowerCase().includes(searchTerm) ||
      (booking.email || "").toLowerCase().includes(searchTerm) ||
      (booking.subject_topic_purpose || "").toLowerCase().includes(searchTerm)
    );
  });

  populateAllBookingsTable(filtered);
}

// ========== LIBRARIES REPORT SECTION ==========
function loadLibrariesSection() {
  generateLibraryStats();
  initLibraryComparisonChart();
  initLibraryUtilizationChart();
  populateLibraryDetailsTable();
}

function generateLibraryStats() {
  const grid = document.getElementById("libraryStatsGrid");
  grid.innerHTML = "";

  Object.keys(libraries).forEach((libId) => {
    const libBookings = filteredBookings.filter((b) => b.library == libId);
    const libName = libraries[libId];
    const count = libBookings.length;
    const hours = libBookings.reduce(
      (sum, b) => sum + (parseInt(b.booked_hour) || 0),
      0
    );

    const card = `
                    <div class="stat-card blue">
                        <div class="stat-icon"><i class="fas fa-building"></i></div>
                        <div class="stat-label">${libName}</div>
                        <div class="stat-value">${count}</div>
                        <div class="stat-change">${hours} total hours</div>
                    </div>
                `;
    grid.innerHTML += card;
  });
}

function initLibraryComparisonChart() {
  const ctx = document.getElementById("libraryComparisonChart");
  if (charts.libraryComparison) charts.libraryComparison.destroy();

  const libraryCounts = {};
  Object.keys(libraries).forEach((id) => {
    libraryCounts[libraries[id]] = filteredBookings.filter(
      (b) => b.library == id
    ).length;
  });

  charts.libraryComparison = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(libraryCounts),
      datasets: [
        {
          label: "Bookings",
          data: Object.values(libraryCounts),
          backgroundColor: [
            "#3498db",
            "#e74c3c",
            "#f39c12",
            "#27ae60",
            "#9b59b6",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initLibraryUtilizationChart() {
  const ctx = document.getElementById("libraryUtilizationChart");
  if (charts.libraryUtilization) charts.libraryUtilization.destroy();

  const total = filteredBookings.length;
  const libraryCounts = {};
  Object.keys(libraries).forEach((id) => {
    const count = filteredBookings.filter((b) => b.library == id).length;
    libraryCounts[libraries[id]] = ((count / total) * 100).toFixed(1);
  });

  charts.libraryUtilization = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(libraryCounts),
      datasets: [
        {
          data: Object.values(libraryCounts),
          backgroundColor: [
            "#3498db",
            "#e74c3c",
            "#f39c12",
            "#27ae60",
            "#9b59b6",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function populateLibraryDetailsTable() {
  const tbody = document.getElementById("libraryDetailsTableBody");
  tbody.innerHTML = "";

  Object.keys(libraries).forEach((libId) => {
    const libName = libraries[libId];
    const libBookings = filteredBookings.filter((b) => b.library == libId);
    const total = libBookings.length;
    const pending = libBookings.filter(
      (b) => (b.status || "").toLowerCase() === "pending"
    ).length;
    const completed = libBookings.filter(
      (b) => (b.status || "").toLowerCase() === "completed"
    ).length;
    const totalHours = libBookings.reduce(
      (sum, b) => sum + (parseInt(b.booked_hour) || 0),
      0
    );
    const avgHours = total > 0 ? (totalHours / total).toFixed(1) : 0;

    // Find most used facility
    const facilityCounts = {};
    libBookings.forEach((b) => {
      if (b.facility) {
        facilityCounts[b.facility] = (facilityCounts[b.facility] || 0) + 1;
      }
    });
    const mostUsedFacId = Object.keys(facilityCounts).reduce(
      (a, b) => (facilityCounts[a] > facilityCounts[b] ? a : b),
      null
    );
    const mostUsedFac = mostUsedFacId ? getFacilityName(mostUsedFacId) : "N/A";

    const row = `
                    <tr>
                        <td><strong>${libName}</strong></td>
                        <td>${total}</td>
                        <td>${pending}</td>
                        <td>${completed}</td>
                        <td>${totalHours}h</td>
                        <td>${avgHours}h</td>
                        <td>${mostUsedFac}</td>
                    </tr>
                `;
    tbody.innerHTML += row;
  });
}

// ========== MONTHLY REPORT SECTION ==========
function loadMonthlySection() {
  calculateMonthlyStats();
  initMonthlyTrendChart();
  initMonthlyStatusChart();
  initMonthlyUserTypeChart();
}

function calculateMonthlyStats() {
  const now = new Date();
  const thisMonth = filteredBookings.filter((b) => {
    if (!b.date) return false;
    const d = new Date(b.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  const lastMonth = filteredBookings.filter((b) => {
    if (!b.date) return false;
    const d = new Date(b.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
    );
  }).length;

  const growth =
    lastMonth > 0
      ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)
      : 0;

  // Find best month
  const monthCounts = {};
  filteredBookings.forEach((b) => {
    if (b.date) {
      const d = new Date(b.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
  });
  const bestMonthKey = Object.keys(monthCounts).reduce(
    (a, b) => (monthCounts[a] > monthCounts[b] ? a : b),
    null
  );
  const bestMonth = bestMonthKey
    ? new Date(
        bestMonthKey.split("-")[0],
        bestMonthKey.split("-")[1]
      ).toLocaleString("default", { month: "short", year: "numeric" })
    : "N/A";

  document.getElementById("stat-this-month").textContent = thisMonth;
  document.getElementById("stat-last-month").textContent = lastMonth;
  document.getElementById("stat-growth-rate").textContent = growth + "%";
  document.getElementById("stat-best-month").textContent = bestMonth;

  document.getElementById("stat-this-month-change").textContent =
    now.toLocaleString("default", { month: "long" });
  document.getElementById("stat-last-month-change").textContent = new Date(
    now.getFullYear(),
    now.getMonth() - 1
  ).toLocaleString("default", { month: "long" });
  document.getElementById("stat-growth-rate-change").innerHTML =
    growth >= 0
      ? '<i class="fas fa-arrow-up"></i> vs last month'
      : '<i class="fas fa-arrow-down"></i> vs last month';
  document.getElementById("stat-best-month-change").textContent = `${
    monthCounts[bestMonthKey] || 0
  } bookings`;
}

function initMonthlyTrendChart() {
  const ctx = document.getElementById("monthlyTrendChart");
  if (charts.monthlyTrend) charts.monthlyTrend.destroy();

  const monthCounts = {};
  filteredBookings.forEach((b) => {
    if (b.date) {
      const d = new Date(b.date);
      const key = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
  });

  const sortedMonths = Object.keys(monthCounts).slice(-12);

  charts.monthlyTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels: sortedMonths,
      datasets: [
        {
          label: "Bookings",
          data: sortedMonths.map((m) => monthCounts[m]),
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initMonthlyStatusChart() {
  const ctx = document.getElementById("monthlyStatusChart");
  if (charts.monthlyStatus) charts.monthlyStatus.destroy();

  // Simplified for demo
  const statuses = ["Pending", "Cancelled", "Completed"];
  const data = statuses.map(
    (s) =>
      filteredBookings.filter(
        (b) => (b.status || "").toLowerCase() === s.toLowerCase()
      ).length
  );

  charts.monthlyStatus = new Chart(ctx, {
    type: "bar",
    data: {
      labels: statuses,
      datasets: [
        {
          label: "Count",
          data: data,
          backgroundColor: ["#f39c12", "#27ae60", "#e74c3c", "#3498db"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initMonthlyUserTypeChart() {
  const ctx = document.getElementById("monthlyUserTypeChart");
  if (charts.monthlyUserType) charts.monthlyUserType.destroy();

  const students = filteredBookings.filter(
    (b) => (b.booker_type || "").toLowerCase() === "student"
  ).length;
  const faculty = filteredBookings.filter(
    (b) => (b.booker_type || "").toLowerCase() === "faculty"
  ).length;

  charts.monthlyUserType = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Students", "Faculty"],
      datasets: [
        {
          data: [students, faculty],
          backgroundColor: ["#3498db", "#9b59b6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// ========== ANALYTICS SECTION ==========
function loadAnalyticsSection() {
  calculateAnalyticsStats();
  initDurationDistributionChart();
  initDayOfWeekChart();
  initHourlyHeatmapChart();
  loadPurposeAnalysis();
}

function calculateAnalyticsStats() {
  const avgDuration = (
    filteredBookings.reduce(
      (sum, b) => sum + (parseInt(b.booked_hour) || 0),
      0
    ) / filteredBookings.length
  ).toFixed(1);

  // Find peak hour
  const hourCounts = {};
  filteredBookings.forEach((b) => {
    if (b.start_time) {
      hourCounts[b.start_time] = (hourCounts[b.start_time] || 0) + 1;
    }
  });
  const peakHour = Object.keys(hourCounts).reduce(
    (a, b) => (hourCounts[a] > hourCounts[b] ? a : b),
    "-"
  );

  // Find top library
  const libCounts = {};
  filteredBookings.forEach((b) => {
    if (b.library) {
      libCounts[b.library] = (libCounts[b.library] || 0) + 1;
    }
  });
  const topLibId = Object.keys(libCounts).reduce(
    (a, b) => (libCounts[a] > libCounts[b] ? a : b),
    null
  );
  const topLib = topLibId
    ? libraries[topLibId] || `Library ${topLibId}`
    : "N/A";

  // Find top booker type
  const typeCounts = {};
  filteredBookings.forEach((b) => {
    if (b.booker_type) {
      typeCounts[b.booker_type] = (typeCounts[b.booker_type] || 0) + 1;
    }
  });
  const topType = Object.keys(typeCounts).reduce(
    (a, b) => (typeCounts[a] > typeCounts[b] ? a : b),
    "N/A"
  );

  document.getElementById("stat-avg-duration").textContent = avgDuration;
  document.getElementById("stat-peak-hour").textContent = formatTime(peakHour);
  document.getElementById("stat-top-library").textContent = topLib;
  document.getElementById("stat-top-booker").textContent = topType;
}

function initDurationDistributionChart() {
  const ctx = document.getElementById("durationDistributionChart");
  if (charts.durationDist) charts.durationDist.destroy();

  const durations = {};
  filteredBookings.forEach((b) => {
    const h = parseInt(b.booked_hour) || 0;
    durations[h] = (durations[h] || 0) + 1;
  });

  charts.durationDist = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(durations).sort((a, b) => a - b),
      datasets: [
        {
          label: "Count",
          data: Object.keys(durations)
            .sort((a, b) => a - b)
            .map((k) => durations[k]),
          backgroundColor: "#3498db",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initDayOfWeekChart() {
  const ctx = document.getElementById("dayOfWeekChart");
  if (charts.dayOfWeek) charts.dayOfWeek.destroy();

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];

  filteredBookings.forEach((b) => {
    if (b.date) {
      const d = new Date(b.date);
      dayCounts[d.getDay()]++;
    }
  });

  charts.dayOfWeek = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        {
          label: "Bookings",
          data: dayCounts,
          backgroundColor: "#27ae60",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initHourlyHeatmapChart() {
  const ctx = document.getElementById("hourlyHeatmapChart");
  if (charts.hourlyHeatmap) charts.hourlyHeatmap.destroy();

  const hourCounts = {};
  filteredBookings.forEach((b) => {
    if (b.start_time) {
      hourCounts[formatTime(b.start_time)] =
        (hourCounts[formatTime(b.start_time)] || 0) + 1;
    }
  });

  const sortedHours = Object.keys(hourCounts).sort();

  charts.hourlyHeatmap = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedHours,
      datasets: [
        {
          label: "Bookings",
          data: sortedHours.map((h) => hourCounts[h]),
          backgroundColor: "#e74c3c",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function loadPurposeAnalysis() {
  const purposeCounts = {};
  filteredBookings.forEach((b) => {
    if (b.subject_topic_purpose) {
      purposeCounts[b.subject_topic_purpose] =
        (purposeCounts[b.subject_topic_purpose] || 0) + 1;
    }
  });

  const sorted = Object.entries(purposeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const list = document.getElementById("purposeAnalysisList");
  list.innerHTML = "";

  sorted.forEach(([purpose, count], index) => {
    const item = `
                    <div style="padding: 10px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${index + 1}.</strong> ${purpose}
                        </div>
                        <div style="background: #3498db; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600;">
                            ${count}
                        </div>
                    </div>
                `;
    list.innerHTML += item;
  });
}

// ========== USER STATISTICS SECTION ==========
function loadUsersSection() {
  calculateUserStats();
  initTopUsersChart();
  initUserTypeDistributionChart();
  populateUserDetailsTable();
}

function calculateUserStats() {
  const users = {};
  filteredBookings.forEach((b) => {
    if (b.email) {
      if (!users[b.email]) {
        users[b.email] = {
          name: b.booking_name,
          type: b.booker_type,
          bookings: [],
        };
      }
      users[b.email].bookings.push(b);
    }
  });

  const totalUsers = Object.keys(users).length;
  const students = Object.values(users).filter(
    (u) => (u.type || "").toLowerCase() === "student"
  ).length;
  const faculty = Object.values(users).filter(
    (u) => (u.type || "").toLowerCase() === "faculty"
  ).length;

  const topUser = Object.entries(users).sort(
    (a, b) => b[1].bookings.length - a[1].bookings.length
  )[0];

  document.getElementById("stat-total-users").textContent = totalUsers;
  document.getElementById("stat-students").textContent = students;
  document.getElementById("stat-faculty").textContent = faculty;
  document.getElementById("stat-top-user").textContent = topUser
    ? topUser[1].name
    : "N/A";
  document.getElementById("stat-top-user-bookings").textContent = topUser
    ? `${topUser[1].bookings.length} bookings`
    : "";

  document.getElementById("stat-students-change").textContent = `${(
    (students / totalUsers) *
    100
  ).toFixed(1)}% of users`;
  document.getElementById("stat-faculty-change").textContent = `${(
    (faculty / totalUsers) *
    100
  ).toFixed(1)}% of users`;
}

function initTopUsersChart() {
  const ctx = document.getElementById("topUsersChart");
  if (charts.topUsers) charts.topUsers.destroy();

  const users = {};
  filteredBookings.forEach((b) => {
    if (b.email) {
      if (!users[b.email]) {
        users[b.email] = { name: b.booking_name, count: 0 };
      }
      users[b.email].count++;
    }
  });

  const top10 = Object.entries(users)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  charts.topUsers = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top10.map((u) => u[1].name),
      datasets: [
        {
          label: "Bookings",
          data: top10.map((u) => u[1].count),
          backgroundColor: "#9b59b6",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function initUserTypeDistributionChart() {
  const ctx = document.getElementById("userTypeDistributionChart");
  if (charts.userTypeDist) charts.userTypeDist.destroy();

  const types = {};
  const users = {};

  filteredBookings.forEach((b) => {
    if (b.email && !users[b.email]) {
      users[b.email] = true;
      const type = b.booker_type || "Unknown";
      types[type] = (types[type] || 0) + 1;
    }
  });

  charts.userTypeDist = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(types),
      datasets: [
        {
          data: Object.values(types),
          backgroundColor: ["#3498db", "#9b59b6", "#e74c3c"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function populateUserDetailsTable() {
  const tbody = document.getElementById("userDetailsTableBody");
  tbody.innerHTML = "";

  const users = {};
  filteredBookings.forEach((b) => {
    if (b.email) {
      if (!users[b.email]) {
        users[b.email] = {
          name: b.booking_name,
          type: b.booker_type,
          bookings: [],
          pending: 0,
          completed: 0,
          hours: 0,
        };
      }
      users[b.email].bookings.push(b);
      if ((b.status || "").toLowerCase() === "pending")
        users[b.email].pending++;
      if ((b.status || "").toLowerCase() === "completed")
        users[b.email].completed++;
      users[b.email].hours += parseInt(b.booked_hour) || 0;
    }
  });

  Object.entries(users)
    .sort((a, b) => b[1].bookings.length - a[1].bookings.length)
    .forEach(([email, user]) => {
      const lastBooking = user.bookings.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];
      const row = `
                        <tr>
                            <td>${user.name}</td>
                            <td>${email}</td>
                            <td>${user.type}</td>
                            <td><strong>${user.bookings.length}</strong></td>
                            <td>${user.pending}</td>
                            <td>${user.completed}</td>
                            <td>${user.hours}h</td>
                            <td>${formatDate(lastBooking.date)}</td>
                        </tr>
                    `;
      tbody.innerHTML += row;
    });
}

function searchUsers() {
  const searchTerm = document.getElementById("searchUsers").value.toLowerCase();
  const rows = document.querySelectorAll("#userDetailsTableBody tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

// Refresh Data
async function refreshData() {
  const btn = event.target.closest("button");
  const icon = btn.querySelector("i");

  // Add spinning animation
  icon.classList.add("fa-spin");
  btn.disabled = true;

  try {
    await loadDashboardData();
  } catch (error) {
    console.error("Error refreshing data:", error);
  } finally {
    // Remove spinning animation
    icon.classList.remove("fa-spin");
    btn.disabled = false;
  }
}

// Export Report
function exportReport() {
  const csvContent = generateCSV();
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `library_bookings_report_${
    new Date().toISOString().split("T")[0]
  }.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Generate CSV
function generateCSV() {
  const headers = [
    "Reference",
    "Name",
    "Type",
    "Email",
    "Users",
    "Purpose",
    "Library",
    "Facility",
    "Date",
    "Start Time",
    "End Time",
    "Status",
    "Hours",
    "Timestamp",
  ];
  const rows = filteredBookings.map((b) => [
    `"${b.booked_reference || ""}"`,
    `"${b.booking_name || ""}"`,
    `"${b.booker_type || ""}"`,
    `"${b.email || ""}"`,
    `"${b.name_users || ""}"`,
    `"${b.subject_topic_purpose || ""}"`,
    `"${getLibraryName(b.library)}"`,
    `"${getFacilityName(b.facility)}"`,
    `"${b.date || ""}"`,
    `"${b.start_time || ""}"`,
    `"${b.end_time || ""}"`,
    `"${b.status || ""}"`,
    `"${b.booked_hour || 0}"`,
    `"${b.timestamp || ""}"`,
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

// function

// Logout
function logout() {
  if (confirm("Are you sure you want to logout?")) {
    // Clear any stored session data if needed
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "index.html";
  }
}

// ========== RESOURCES STATISTICS SECTION ==========

// Load Resources Data from API
async function loadResourcesData() {
  try {
    const response = await fetch(resourcesAPI);

    if (!response.ok) {
      throw new Error("Failed to fetch resources");
    }

    const data = await response.json();
    console.log("Resources API Response:", data);

    let resourcesData = [];
    if (data.status === "success" && data.data) {
      resourcesData = Array.isArray(data.data) ? data.data : [data.data];
    } else if (Array.isArray(data)) {
      resourcesData = data;
    }

    // Transform data to ensure consistent property names
    allResources = resourcesData.map((resource) => ({
      id: resource.id || resource.ID,
      reference_number: resource.reference_number || resource.booked_reference,
      bookers_name: resource.bookers_name || resource.booking_name,
      bookers_type: resource.bookers_type || resource.booker_type,
      email: resource.email,
      utilization_of_materials:
        resource.utilization_of_materials || resource.utilization,
      type_of_materials: resource.type_of_materials || resource.material_type,
      booked_resources_id: resource.booked_resources_id || resource.resource_id,
      date: resource.date,
      timestamp: resource.timestamp,
    }));

    filteredResources = [...allResources];
    console.log("Processed resources:", allResources);
    console.log("Total resources loaded:", allResources.length);
  } catch (error) {
    console.error("Error loading resources data:", error);
    // Use sample data if API fails
    loadSampleResourcesData();
  }
}

// Load Sample Resources Data (for testing)
function loadSampleResourcesData() {
  const handleFetchBookingResources = async () => {
    try {
      const response = await fetch(resourcesAPI);

      if (!response.ok) throw new Error("Fetch booking error");

      const result = await response.json();
      return result;
    } catch (e) {
      console.log(e);
    }
  };

  allResources = [];

  handleFetchBookingResources().then((datas) => {
    allResources = datas;
  });

  console.log(allResources);

  //   allResources = [
  //     {
  //       id: 1,
  //       reference_number: "BK1766926383423",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "books",
  //       booked_resources_id: 1,
  //       date: "2025-12-29",
  //       timestamp: "12/28/2025 20:53:06",
  //     },
  //     {
  //       id: 2,
  //       reference_number: "BK1766926460983",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "books",
  //       booked_resources_id: 2,
  //       date: "2025-12-29",
  //       timestamp: "12/28/2025 20:54:24",
  //     },
  //     {
  //       id: 3,
  //       reference_number: "BK1766966858528",
  //       bookers_name: "Princess Ann S. Ajoc",
  //       bookers_type: "student",
  //       email: "princessannajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "books",
  //       booked_resources_id: 1,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:07:41",
  //     },
  //     {
  //       id: 4,
  //       reference_number: "BK1766966905141",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 4,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:08:27",
  //     },
  //     {
  //       id: 5,
  //       reference_number: "BK1766966960509",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 6,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:09:22",
  //     },
  //     {
  //       id: 6,
  //       reference_number: "BK1766967009558",
  //       bookers_name: "Princess Ann S. Ajoc",
  //       bookers_type: "student",
  //       email: "princessannajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "periodicals",
  //       booked_resources_id: 12,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:10:11",
  //     },
  //     {
  //       id: 7,
  //       reference_number: "BK1766967072669",
  //       bookers_name: "Princess Ann S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "home",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 5,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:11:15",
  //     },
  //     {
  //       id: 8,
  //       reference_number: "BK1766967134590",
  //       bookers_name: "Princess Ann S. Ajoc",
  //       bookers_type: "faculty",
  //       email: "princessannajoc@gmail.com",
  //       utilization_of_materials: "home",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 6,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:12:17",
  //     },
  //     {
  //       id: 9,
  //       reference_number: "BK1766967214917",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 5,
  //       date: "2025-12-29",
  //       timestamp: "12/29/2025 8:13:37",
  //     },
  //     {
  //       id: 10,
  //       reference_number: "BK1766967284621",
  //       bookers_name: "Princess Ann S. Ajoc",
  //       bookers_type: "student",
  //       email: "princessannajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "fiction",
  //       booked_resources_id: 5,
  //       date: "2025-12-30",
  //       timestamp: "12/29/2025 8:14:47",
  //     },
  //     {
  //       id: 11,
  //       reference_number: "BK1767024768024",
  //       bookers_name: "Prince Carl S. Ajoc",
  //       bookers_type: "student",
  //       email: "princecarlajoc@gmail.com",
  //       utilization_of_materials: "inside",
  //       type_of_materials: "books",
  //       booked_resources_id: 1,
  //       date: "2025-12-31",
  //       timestamp: "12/30/2025 0:12:51",
  //     },
  //   ];

  filteredResources = [...allResources];
  console.log("Sample resources data loaded:", allResources.length);
}

// Load Resources Section
async function loadResourcesSection() {
  // Load resources data if not already loaded
  if (allResources.length === 0) {
    await loadResourcesData();
  }

  updateResourcesStats();
  initResourcesCharts();
  populateResourcesTable();
}

// Update Resources Statistics
function updateResourcesStats() {
  const total = filteredResources.length;
  const homeUtilization = filteredResources.filter(
    (r) =>
      r.utilization_of_materials &&
      r.utilization_of_materials.toLowerCase() === "home"
  ).length;
  const insideUtilization = filteredResources.filter(
    (r) =>
      r.utilization_of_materials &&
      r.utilization_of_materials.toLowerCase() === "inside"
  ).length;

  // Find most popular material type
  const materialCounts = {};
  filteredResources.forEach((r) => {
    if (r.type_of_materials) {
      materialCounts[r.type_of_materials] =
        (materialCounts[r.type_of_materials] || 0) + 1;
    }
  });
  const popularMaterial = Object.keys(materialCounts).reduce(
    (a, b) => (materialCounts[a] > materialCounts[b] ? a : b),
    null
  );

  // Unique users
  const uniqueUsers = new Set(
    filteredResources.filter((r) => r.email).map((r) => r.email)
  ).size;

  // Student bookings
  const studentBookings = filteredResources.filter(
    (r) => r.bookers_type && r.bookers_type.toLowerCase() === "student"
  ).length;

  // Update stat values
  document.getElementById("stat-total-resources").textContent = total;
  document.getElementById("stat-home-utilization").textContent =
    homeUtilization;
  document.getElementById("stat-inside-utilization").textContent =
    insideUtilization;
  document.getElementById("stat-popular-material").textContent =
    popularMaterial || "N/A";
  document.getElementById("stat-resource-users").textContent = uniqueUsers;
  document.getElementById("stat-student-resources").textContent =
    studentBookings;

  // Update stat changes
  const homePercent =
    total > 0 ? ((homeUtilization / total) * 100).toFixed(1) : 0;
  const insidePercent =
    total > 0 ? ((insideUtilization / total) * 100).toFixed(1) : 0;
  const studentPercent =
    total > 0 ? ((studentBookings / total) * 100).toFixed(1) : 0;

  document.getElementById(
    "stat-home-utilization-change"
  ).textContent = `${homePercent}% of total`;
  document.getElementById(
    "stat-inside-utilization-change"
  ).textContent = `${insidePercent}% of total`;
  document.getElementById("stat-popular-material-change").textContent = `${
    materialCounts[popularMaterial] || 0
  } bookings`;
  document.getElementById(
    "stat-student-resources-change"
  ).textContent = `${studentPercent}% of total`;
}

// Initialize Resources Charts
function initResourcesCharts() {
  initResourcesTrendChart();
  initMaterialTypeChart();
  initUtilizationTypeChart();
  initTopResourcesChart();
  initResourceBookerTypeChart();
  initResourceMonthlyChart();
}

// Resources Trend Chart
function initResourcesTrendChart() {
  const ctx = document.getElementById("resourcesTrendChart");
  if (charts.resourcesTrend) charts.resourcesTrend.destroy();

  const resourcesByDate = {};
  filteredResources.forEach((resource) => {
    if (resource.date) {
      const date = resource.date;
      resourcesByDate[date] = (resourcesByDate[date] || 0) + 1;
    }
  });

  const rawDates = Object.keys(resourcesByDate).sort();
  const dates = rawDates.map((dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const counts = rawDates.map((date) => resourcesByDate[date]);

  charts.resourcesTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Resource Bookings",
          data: counts,
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Material Type Chart
function initMaterialTypeChart() {
  const ctx = document.getElementById("materialTypeChart");
  if (charts.materialType) charts.materialType.destroy();

  const materialCounts = {};
  filteredResources.forEach((resource) => {
    const material = resource.type_of_materials || "Unknown";
    materialCounts[material] = (materialCounts[material] || 0) + 1;
  });

  const labels = Object.keys(materialCounts).map(
    (m) => m.charAt(0).toUpperCase() + m.slice(1)
  );

  charts.materialType = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: Object.values(materialCounts),
          backgroundColor: [
            "#3498db",
            "#e74c3c",
            "#f39c12",
            "#27ae60",
            "#9b59b6",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Utilization Type Chart
function initUtilizationTypeChart() {
  const ctx = document.getElementById("utilizationTypeChart");
  if (charts.utilizationType) charts.utilizationType.destroy();

  const utilizationCounts = {};
  filteredResources.forEach((resource) => {
    const utilization = resource.utilization_of_materials || "Unknown";
    utilizationCounts[utilization] = (utilizationCounts[utilization] || 0) + 1;
  });

  const labels = Object.keys(utilizationCounts).map(
    (u) => u.charAt(0).toUpperCase() + u.slice(1)
  );

  charts.utilizationType = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: Object.values(utilizationCounts),
          backgroundColor: ["#27ae60", "#9b59b6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Top Resources Chart
function initTopResourcesChart() {
  const ctx = document.getElementById("topResourcesChart");
  if (charts.topResources) charts.topResources.destroy();

  const resourceCounts = {};
  filteredResources.forEach((resource) => {
    if (resource.booked_resources_id) {
      const resId = `Resource ${resource.booked_resources_id}`;
      resourceCounts[resId] = (resourceCounts[resId] || 0) + 1;
    }
  });

  const top10 = Object.entries(resourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  charts.topResources = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top10.map((r) => r[0]),
      datasets: [
        {
          label: "Bookings",
          data: top10.map((r) => r[1]),
          backgroundColor: "#f39c12",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Resource Booker Type Chart
function initResourceBookerTypeChart() {
  const ctx = document.getElementById("resourceBookerTypeChart");
  if (charts.resourceBookerType) charts.resourceBookerType.destroy();

  const typeCounts = {};
  filteredResources.forEach((resource) => {
    const type = resource.bookers_type || "Unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const labels = Object.keys(typeCounts).map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1)
  );

  charts.resourceBookerType = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: Object.values(typeCounts),
          backgroundColor: ["#3498db", "#9b59b6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Resource Monthly Chart
function initResourceMonthlyChart() {
  const ctx = document.getElementById("resourceMonthlyChart");
  if (charts.resourceMonthly) charts.resourceMonthly.destroy();

  const monthCounts = {};
  filteredResources.forEach((resource) => {
    if (resource.date) {
      try {
        const date = new Date(resource.date);
        if (!isNaN(date.getTime())) {
          const month = date.toLocaleString("default", {
            month: "short",
            year: "numeric",
          });
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
      } catch (e) {
        console.warn("Invalid date:", resource.date);
      }
    }
  });

  charts.resourceMonthly = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(monthCounts),
      datasets: [
        {
          label: "Resource Bookings",
          data: Object.values(monthCounts),
          backgroundColor: "#9b59b6",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// Populate Resources Table
function populateResourcesTable() {
  const tbody = document.getElementById("resourcesTableBody");
  tbody.innerHTML = "";

  if (filteredResources.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px;">
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>No resource bookings found</h3>
            <p>No data available</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  filteredResources.slice(0, 50).forEach((resource) => {
    const utilizationClass = (
      resource.utilization_of_materials || ""
    ).toLowerCase();
    const utilizationBadge =
      utilizationClass === "home"
        ? '<span class="status-badge status-completed">Home</span>'
        : '<span class="status-badge status-pending">Inside</span>';

    const row = `
      <tr>
        <td>${resource.reference_number || "N/A"}</td>
        <td>${resource.bookers_name || "N/A"}</td>
        <td>${resource.bookers_type || "N/A"}</td>
        <td>${resource.email || "N/A"}</td>
        <td><strong>${resource.type_of_materials || "N/A"}</strong></td>
        <td>${utilizationBadge}</td>
        <td>${resource.booked_resources_id || "N/A"}</td>
        <td>${formatDate(resource.date)}</td>
        <td>${resource.timestamp || "N/A"}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

// Search Resources
function searchResources() {
  const searchTerm = document
    .getElementById("searchResourcesInput")
    .value.toLowerCase();

  if (!searchTerm) {
    filteredResources = [...allResources];
    populateResourcesTable();
    return;
  }

  filteredResources = allResources.filter((resource) => {
    const reference = (resource.reference_number || "").toLowerCase();
    const name = (resource.bookers_name || "").toLowerCase();
    const email = (resource.email || "").toLowerCase();
    const material = (resource.type_of_materials || "").toLowerCase();
    const utilization = (resource.utilization_of_materials || "").toLowerCase();

    return (
      reference.includes(searchTerm) ||
      name.includes(searchTerm) ||
      email.includes(searchTerm) ||
      material.includes(searchTerm) ||
      utilization.includes(searchTerm)
    );
  });

  populateResourcesTable();
  updateResourcesStats();
}
