// Konstanta dan Variabel Global
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const API_KEY = 'f00c38e0279b7bc85480c3fe775d518c';

// Variabel global untuk instance grafik agar dapat dihancurkan jika diperlukan
let forecastData = null;
let tempChartInstance = null;
let windChartInstance = null;

// Fungsi untuk Mengubah Background Berdasarkan Waktu
function updateBackgroundBasedOnTime(data) {
    const timezoneOffset = data.city.timezone / 3600; // Zona waktu kota
    const currentTime = moment().utcOffset(timezoneOffset); // Waktu lokal saat ini

    const isDaytime = currentTime.hours() >= 6 && currentTime.hours() < 18; 

    document.body.classList.remove('daytime','nighttime')

    if (isDaytime) {
        document.body.classList.add('daytime');
    } else {
        document.body.classList.add('nighttime');
    }
}

// Inisialisasi Saat Halaman Dimuat
$(document).ready(function () {
    weatherFn('Bandung'); // Kota default saat halaman dimuat
});

// Fungsi Utama untuk Mendapatkan Data Cuaca
async function weatherFn(cityName) {
    const currentWeatherUrl = `${API_BASE_URL}/weather?q=${cityName}&appid=${API_KEY}&units=metric`;
    const forecastUrl = `${API_BASE_URL}/forecast?q=${cityName}&appid=${API_KEY}&units=metric`;

    // Reset pesan error dan tampilkan loading
    $('#error-message').hide();
    $('#loading').show();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentWeatherUrl),
            fetch(forecastUrl)
        ]);

        if (!currentRes.ok || !forecastRes.ok) {
            showError('Kota tidak ditemukan. Coba nama kota lain.');
            return;
        }

        const currentData = await currentRes.json();
        forecastData = await forecastRes.json();

        // Menampilkan data cuaca dan grafik hourly (default)
        $('#loading').hide();
        displayCurrentWeather(currentData);
        drawCharts(forecastData, 'hourly');
        displayRainAverage(forecastData, 'hourly');
        updateBackgroundBasedOnTime(forecastData);
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Gagal memuat data cuaca. Periksa koneksi Anda.');
    }
}


// Fungsi untuk Menampilkan Pesan Error
function showError(message) {
    $('#error-message').text(message).show();
    $('#loading').hide();
}

// Fungsi untuk Menghitung dan Menampilkan Rata-rata Curah Hujan
function displayRainAverage(data, mode) {
    const timezoneOffset = data.city.timezone / 3600;
    const currentTime = moment().utcOffset(timezoneOffset);
    
    let startTime, endTime;
    if (mode === 'hourly') {
        startTime = currentTime.clone().startOf('day');
        endTime = currentTime.clone().endOf('day');
    } else if (mode === 'next-day') {
        startTime = currentTime.clone().add(1, 'days').startOf('day');
        endTime = currentTime.clone().add(1, 'days').endOf('day');
    } else {
        $('#rata-rata-hujan').hide();
        return;
    }

    const rainData = data.list
        .map(item => item.rain ? item.rain['3h'] : 0)
        .filter((rain, index) => {
            const itemTime = moment(data.list[index].dt_txt).utcOffset(timezoneOffset);
            return itemTime.isBetween(startTime, endTime, null, '[)');
        })
        .filter(rain => rain > 0);

    const rainAverage = rainData.length > 0
        ? (rainData.reduce((sum, rain) => sum + rain, 0) / rainData.length).toFixed(2)
        : 0;

    $('#rata-rata-hujan').html(`Rata-rata Hujan: ${rainAverage} mm`).show();
}


// Fungsi untuk Menampilkan Data Cuaca Saat Ini
function displayCurrentWeather(data) {
    const timezoneOffset = data.timezone / 3600;
    const localTime = moment().utcOffset(timezoneOffset).format('MMMM Do YYYY, HH:mm:ss ');
    $('#city-name').text(data.name);
    $('#temperature').html(`${data.main.temp}&deg;C`);
    $('#description').text(data.weather[0].description);
    $('#wind-speed').text(`Kecepatan Angin: ${data.wind.speed} m/s`);
    $('#weather-icon').attr('src', `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`);
    $('#weather-info').fadeIn();
}

// Variabel global untuk pengaturan rentang waktu
let startTimeOffset = 0;
let timeRange = 24;

// Fungsi untuk menggambar grafik berdasarkan waktu sekarang dan rentang waktu
function drawCharts(data, mode = 'hourly') {
    const timezoneOffset = data.city.timezone / 3600;
    const currentTime = moment().utcOffset(timezoneOffset);
    
    let filteredData;
    let labels;
    let temperatures;
    let windSpeeds;

    // Menentukan rentang waktu untuk grafik
    if (mode === 'hourly') {
        const startTime = currentTime.clone();
        const endTime = startTime.clone().add(24, 'hours');
        filteredData = data.list.filter(item => {
            const itemTime = moment(item.dt_txt).utcOffset(timezoneOffset);
            return itemTime.isBetween(startTime, endTime, null, '[)');
        });
    } else if (mode === 'next-day') {
        const startTime = currentTime.clone().add(1, 'days').startOf('day');
        const endTime = startTime.clone().endOf('day');
        
        filteredData = data.list.filter(item => {
            const itemTime = moment(item.dt_txt).utcOffset(timezoneOffset);
            return itemTime.isBetween(startTime, endTime, null, '[)');
        });
    } else if (mode === '5-days') {
        const startTime = currentTime.clone();
        const endTime = startTime.clone().add(5, 'days').endOf('day');
        
        filteredData = data.list.filter(item => {
            const itemTime = moment(item.dt_txt).utcOffset(timezoneOffset);
            return itemTime.isBetween(startTime, endTime, null, '[)');
        });
    }

    // Ambil label dan data suhu/kecepatan angin
    labels = filteredData.map(item => moment(item.dt_txt).utcOffset(timezoneOffset).format('DD/MM/YY, HH:mm'));
    temperatures = filteredData.map(item => item.main.temp);
    windSpeeds = filteredData.map(item => item.wind.speed);

    // Hapus grafik sebelumnya jika ada
    if (tempChartInstance) tempChartInstance.destroy();
    tempChartInstance = new Chart(document.getElementById('chartSuhu'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suhu (°C)',
                data: temperatures,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal dan Waktu'
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit:10,
                        maxRotation: 45,
                        minRotation: 30
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Suhu (°C)'
                    }
                }
            }
        }
    });

    if (windChartInstance) windChartInstance.destroy();
    windChartInstance = new Chart(document.getElementById('chartAngin'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kecepatan Angin (m/s)',
                data: windSpeeds,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal dan Waktu'
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 45,
                        minRotation: 30
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Kecepatan Angin (m/s)'
                    }
                }
            }
        }
    });
}

// Tambahkan event listener pada tombol
$('#hourly').on('click', function () {
    drawCharts(forecastData, 'hourly');
    $('#rata-rata-hujan').show();
    $('h2:contains("Prakiraan Rata-rata Hujan")').show()
    displayRainAverage(forecastData, 'hourly');
    
});

$('#next-day').on('click', function () {
    drawCharts(forecastData, 'next-day');
    $('#rata-rata-hujan').show();
    $('h2:contains("Prakiraan Rata-rata Hujan")').show()
    displayRainAverage(forecastData, 'next-day');
});

$('#five-days-forecast').on('click', function () {
    $('#rata-rata-hujan').hide(); 
    $('h2:contains("Prakiraan Rata-rata Hujan")').hide()
    drawCharts(forecastData, '5-days');
});

// Fungsi untuk Menampilkan Waktu Saat Ini
function displayTime() {
    const timezoneOffset = forecastData.city.timezone / 3600; // Gunakan zona waktu kota yang dipilih
    const currentTime = moment().utcOffset(timezoneOffset).format('MMMM Do YYYY, HH:mm:ss '); // Tampilkan waktu yang disesuaikan
    const timeElement = document.getElementById("current-time");
    timeElement.innerText = `Waktu saat ini: ${currentTime}`;
}

// Update waktu setiap detik
setInterval(displayTime, 1000);
