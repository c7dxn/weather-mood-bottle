const API_KEY = "72dfce0768eb14284481f07a479bbbec";
const FIREBASE_DB_URL = "https://weather-mood-bottle-default-rtdb.asia-southeast1.firebasedatabase.app";

const searchBtn = document.getElementById("searchBtn");
const geoBtn = document.getElementById("geoBtn");
const randomBtn = document.getElementById("randomBtn");
const cityInput = document.getElementById("cityInput");
const moodMessage = document.getElementById("moodMessage");
const healthAdvice = document.getElementById("healthAdvice");
const localTimeDisplay = document.getElementById("localTimeDisplay");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const messageInput = document.getElementById("messageInput");
const postMsgBtn = document.getElementById("postMsgBtn");
const messageList = document.getElementById("messageList");
const msgCityTitle = document.getElementById("msgCityTitle");

let currentSearchId = 0;
let currentActiveCity = "臺北市";
let selectedMoodTag = "愜意";
let currentWeatherType = "Clouds";
let latestCloudCityMessages = [];

let currentCityState = {
    name: "臺北市",
    englishName: "Taipei",
    temp: 25,
    humidity: 60,
    pressure: 1013,
    weatherDesc: "多雲",
    weatherCondition: "Clouds",
    timezone: 28800,
    localTimeStr: "12:00",
    period: "午後時光",
    moodText: ""
};

// ==========================================
// 0. Web Audio API 天氣白噪音合成器
// ==========================================
let audioCtx = null;
let noiseNode = null;
let gainNode = null;
let isPlayingSound = false;

function startWeatherSound(weatherType) {
    stopWeatherSound();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (weatherType === "Rain" || weatherType === "Drizzle" || weatherType === "Thunderstorm") {
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
        } else if (weatherType === "Snow") {
            b0 = (b0 + (0.02 * white)) / 1.02;
            output[i] = b0 * 0.8;
        } else {
            b0 = 0.997 * b0 + white * 0.029;
            output[i] = b0 * 0.45;
        }
    }

    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = (weatherType === "Rain" || weatherType === "Drizzle") ? 1100 : 450;

    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 1.2);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseNode.start();

    isPlayingSound = true;
    const soundLabel = (weatherType === "Rain" || weatherType === "Drizzle" || weatherType === "Thunderstorm")
        ? "雨聲播放中"
        : (weatherType === "Snow" ? "雪風播放中" : "微風播放中");
    soundToggleBtn.innerText = soundLabel;
    soundToggleBtn.classList.add("playing");
}

function stopWeatherSound() {
    if (noiseNode) {
        try { noiseNode.stop(); noiseNode.disconnect(); } catch (e) {}
        noiseNode = null;
    }
    isPlayingSound = false;
    soundToggleBtn.innerText = "聆聽環境音";
    soundToggleBtn.classList.remove("playing");
}

soundToggleBtn.addEventListener("click", () => {
    if (isPlayingSound) {
        stopWeatherSound();
    } else {
        startWeatherSound(currentWeatherType);
    }
});

// ==========================================
// 1. 專業級全字庫「簡體轉台灣繁體」轉換器 (OpenCC)
// ==========================================
const s2tConverter = (typeof OpenCC !== "undefined")
    ? OpenCC.Converter({ from: "cn", to: "twp" })
    : null;

function toTraditionalChinese(text) {
    if (!text) return "";
    let cleaned = text.split(";")[0].split("；")[0].trim();

    if (s2tConverter) {
        cleaned = s2tConverter(cleaned);
    }

    return cleaned
        .replace(/多云/g, "多雲")
        .replace(/阴天/g, "陰天")
        .replace(/阵雨/g, "陣雨")
        .replace(/薄雾/g, "薄霧")
        .replace(/大雾/g, "大霧");
}

// ==========================================
// 2. 隨機任意門城市清單
// ==========================================
const randomDestinations = [
    "冰島", "雷克雅維克", "不丹", "馬爾地夫", "列支敦斯登", "聖托里尼",
    "委內瑞拉", "秘魯", "庫斯科", "摩洛哥", "卡薩布蘭卡", "開羅",
    "紐西蘭", "皇后鎮", "蘇黎世", "布拉格", "維也納", "哥本哈根",
    "赫爾辛基", "京都", "札幌", "濟州島", "清邁", "河內",
    "溫哥華", "西雅圖", "舊金山", "里約熱內盧", "布宜諾斯艾利斯", "吐瓦魯"
];

// ==========================================
// 3. 地標與天氣氛圍背景圖庫
// ==========================================
const landmarkDatabase = {
    "Taipei": "https://images.unsplash.com/photo-1508248467877-aec1b08de376?auto=format&fit=crop&w=1600&q=80",
    "台北": "https://images.unsplash.com/photo-1508248467877-aec1b08de376?auto=format&fit=crop&w=1600&q=80",
    "臺北市": "https://images.unsplash.com/photo-1508248467877-aec1b08de376?auto=format&fit=crop&w=1600&q=80",
    "Tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80",
    "東京": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80",
    "New York": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1600&q=80",
    "紐約": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1600&q=80",
    "London": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80",
    "倫敦": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80",
    "Paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80",
    "巴黎": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80",
    "Seoul": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
    "首爾": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
    "Sydney": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1600&q=80",
    "雪梨": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1600&q=80",
    "Rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80",
    "羅馬": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80"
};

const weatherBgDatabase = {
    "Clear": "https://images.unsplash.com/photo-1601297183305-6df142704ea2?auto=format&fit=crop&w=1600&q=80",
    "Clouds": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=80",
    "Rain": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1600&q=80",
    "Drizzle": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1600&q=80",
    "Thunderstorm": "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=1600&q=80",
    "Snow": "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=1600&q=80",
    "Mist": "https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=1600&q=80",
    "Fog": "https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=1600&q=80",
    "Haze": "https://images.unsplash.com/photo-1522163723043-478ef79a5bb4?auto=format&fit=crop&w=1600&q=80",
    "DEFAULT": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
};

async function fetchWikipediaImage(queryName) {
    if (!queryName) return null;
    try {
        const res = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(queryName)}&redirects=1&prop=pageimages&format=json&pithumbsize=1400&origin=*`
        );
        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const pageId = Object.keys(pages)[0];
        if (pageId !== "-1" && pages[pageId].thumbnail?.source) {
            return pages[pageId].thumbnail.source;
        }
    } catch (e) {}
    return null;
}

// ==========================================
// 4. 全球地理座標查詢
// ==========================================
async function resolveLocation(query) {
    try {
        const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&namedetails=1&accept-language=zh-TW&limit=1`;
        const osmRes = await fetch(osmUrl);

        if (osmRes.ok) {
            const osmData = await osmRes.json();
            if (osmData && osmData.length > 0) {
                const place = osmData[0];
                const addr = place.address || {};
                const names = place.namedetails || {};

                const rawLocalName = names["name:zh-Hant"] || names["name:zh-TW"] || place.name || addr.city || addr.town || addr.country || query;
                const cleanDisplayName = toTraditionalChinese(rawLocalName);

                const rawEn = names["name:en"] || names["int_name"] || "";
                const englishName = rawEn ? rawEn.split(";")[0].trim() : "";

                return {
                    lat: parseFloat(place.lat),
                    lon: parseFloat(place.lon),
                    displayName: cleanDisplayName,
                    englishName: englishName
                };
            }
        }
    } catch (e) {}

    try {
        const geoRes = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`
        );
        if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
                const loc = geoData[0];
                const rawName = (loc.local_names && (loc.local_names.zh_tw || loc.local_names.zh)) || loc.name;
                return {
                    lat: loc.lat,
                    lon: loc.lon,
                    displayName: toTraditionalChinese(rawName),
                    englishName: loc.name
                };
            }
        }
    } catch (e) {}

    return null;
}

// ==========================================
// 5. 計算當地即時時間與日夜時段
// ==========================================
function calculateLocalTimeInfo(timezoneOffsetSeconds) {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localDate = new Date(utcMs + (timezoneOffsetSeconds * 1000));

    const hours = localDate.getHours();
    const minutes = localDate.getMinutes().toString().padStart(2, "0");
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes}`;

    let period = "白晝時光";
    let isNight = false;

    if (hours >= 5 && hours < 11) {
        period = "清晨朝氣";
    } else if (hours >= 11 && hours < 17) {
        period = "午後時光";
    } else if (hours >= 17 && hours < 20) {
        period = "黃昏日落";
    } else {
        period = "靜謐深夜";
        isNight = true;
    }

    return { timeStr, period, isNight };
}

// ==========================================
// 6. 醫資專業：依據溫度、濕度、氣壓生成身心健康建議
// ==========================================
function generateHealthAdvice(temp, humidity, pressure, weatherCondition) {
    if (pressure <= 1005 || (humidity >= 82 && (weatherCondition === "Rain" || weatherCondition === "Thunderstorm"))) {
        return `當地氣壓偏低（${pressure} hPa）且濕度高達 ${humidity}%，容易誘發偏頭痛、關節痠痛或自律神經緊繃。建議多補充溫水、熱敷肩頸並減少咖啡因攝取。`;
    }
    if (temp <= 10) {
        return `當地氣溫僅 ${temp}°C，低溫易使末梢血管收縮與血壓波動。外出請務必加強頸部與四肢保暖，室內也建議適度伸展促進血液循環。`;
    }
    if (temp >= 31 && humidity >= 70) {
        return `高溫（${temp}°C）伴隨高濕度會降低汗液蒸發效率，體感悶熱易引發熱疲勞與脫水。請定時補充電解質與水分，避免正午劇烈日曬。`;
    }
    if (weatherCondition === "Clear" && temp >= 18 && temp <= 27) {
        return `溫濕度與氣壓（${pressure} hPa）皆處於人體最舒適的黃金區間！非常適合外出曬太陽 15 分鐘，促進維生素 D 合成並提升血清素與好心情。`;
    }
    return `目前氣壓穩定（${pressure} hPa）、濕度 ${humidity}%，人體生理節律平穩。建議維持規律作息，適時起身活動筋骨、遠眺放鬆雙眼。`;
}

// ==========================================
// 互動功能 1：今日身心狀態自評
// ==========================================
const symptomFeedbackEl = document.getElementById("symptomFeedback");

function resetSymptomUI() {
    document.querySelectorAll(".symptom-btn").forEach(b => b.classList.remove("active"));
    symptomFeedbackEl.style.display = "none";
}

document.querySelectorAll(".symptom-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".symptom-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const symptom = btn.getAttribute("data-symptom");
        const { name, temp, humidity, pressure } = currentCityState;
        let advice = "";

        if (symptom === "精神飽滿") {
            advice = `目前${name}氣壓 ${pressure} hPa、氣溫 ${temp}°C，您的生理節律與環境契合度極佳！建議把握專注力高峰處理重要任務，並維持每小時起身飲水習慣。`;
        } else if (symptom === "微倦想睡") {
            advice = `當濕度達 ${humidity}% 或氣壓波動時，副交感神經容易占上風造成嗜睡。建議起身做 3 分鐘擴胸伸展、補充 250ml 常溫開水，或開啟上方「正念呼吸」重整思緒。`;
        } else if (symptom === "頭脹偏頭痛") {
            advice = pressure <= 1008
                ? `偵測到${name}氣壓偏低（${pressure} hPa），低氣壓易使腦部血管擴張誘發偏頭痛。建議遠離強光螢幕、溫敷後頸風池穴 5 分鐘，並減少含糖或高咖啡因飲品。`
                : `目前氣壓為 ${pressure} hPa，若仍感頭脹，可能與溫差（${temp}°C）或肩頸緊繃有關。建議閉目休息、緩慢深呼吸並適度補充水分。`;
        } else if (symptom === "關節痠痛") {
            advice = humidity >= 75 || temp <= 16
                ? `目前${name}濕度 ${humidity}%、氣溫 ${temp}°C，濕冷環境易使關節滑液黏稠度增加。建議局部熱敷 15 分鐘並進行和緩的關節活動度伸展。`
                : `目前氣壓 ${pressure} hPa、濕度 ${humidity}%，建議避免久坐固定姿勢，適度熱敷與溫和伸展可有效緩解肌筋膜緊繃。`;
        }

        symptomFeedbackEl.innerText = advice;
        symptomFeedbackEl.style.display = "block";
    });
});

// ==========================================
// 互動功能 3：4-7-8 正念呼吸引導練習
// ==========================================
const breatheToggleBtn = document.getElementById("breatheToggleBtn");
const breathingPanel = document.getElementById("breathingPanel");
const breathingCircle = document.getElementById("breathingCircle");
const breathingPhaseText = document.getElementById("breathingPhaseText");
const breathingActionBtn = document.getElementById("breathingActionBtn");

let isBreathingActive = false;
let breathingTimer = null;

breatheToggleBtn.addEventListener("click", () => {
    const isHidden = breathingPanel.style.display === "none";
    breathingPanel.style.display = isHidden ? "flex" : "none";
    if (!isHidden) {
        stopBreathingCycle();
    }
});

function runBreathingCycle() {
    if (!isBreathingActive) return;

    breathingCircle.className = "breathing-circle inhale";
    breathingCircle.innerText = "吸氣";
    breathingPhaseText.innerText = "用鼻子緩慢深吸氣（4 秒）...";

    breathingTimer = setTimeout(() => {
        if (!isBreathingActive) return;
        breathingCircle.className = "breathing-circle hold";
        breathingCircle.innerText = "屏息";
        breathingPhaseText.innerText = "輕柔屏住呼吸，感受平靜（7 秒）...";

        breathingTimer = setTimeout(() => {
            if (!isBreathingActive) return;
            breathingCircle.className = "breathing-circle exhale";
            breathingCircle.innerText = "吐氣";
            breathingPhaseText.innerText = "用嘴巴緩緩吐盡濁氣（8 秒）...";

            breathingTimer = setTimeout(() => {
                if (isBreathingActive) runBreathingCycle();
            }, 8000);
        }, 7000);
    }, 4000);
}

function stopBreathingCycle() {
    isBreathingActive = false;
    clearTimeout(breathingTimer);
    breathingCircle.className = "breathing-circle";
    breathingCircle.innerText = "準備";
    breathingPhaseText.innerText = "點擊開始，跟隨節奏調節自律神經";
    breathingActionBtn.innerText = "開始練習";
}

breathingActionBtn.addEventListener("click", () => {
    if (isBreathingActive) {
        stopBreathingCycle();
    } else {
        isBreathingActive = true;
        breathingActionBtn.innerText = "停止練習";
        runBreathingCycle();
    }
});

// ==========================================
// 互動功能 5：雙城心靈時差與溫差對比
// ==========================================
const setHomeCityBtn = document.getElementById("setHomeCityBtn");
const homeCityLabel = document.getElementById("homeCityLabel");
const homeCompareText = document.getElementById("homeCompareText");

setHomeCityBtn.addEventListener("click", () => {
    const homeData = {
        name: currentCityState.name,
        temp: currentCityState.temp,
        timezone: currentCityState.timezone
    };
    localStorage.setItem("weatherHomeCity", JSON.stringify(homeData));
    updateHomeComparisonUI();
});

function updateHomeComparisonUI() {
    const savedHome = JSON.parse(localStorage.getItem("weatherHomeCity"));
    if (!savedHome) {
        homeCityLabel.innerText = "我的基準城市：尚未設定";
        homeCompareText.style.display = "none";
        return;
    }

    homeCityLabel.innerText = `我的基準城市：${savedHome.name}（${savedHome.temp}°C）`;

    if (savedHome.name === currentCityState.name) {
        homeCompareText.innerText = `您目前正位於基準城市「${savedHome.name}」，與當地零時差。`;
        homeCompareText.style.display = "block";
        return;
    }

    const diffHours = Math.round(((currentCityState.timezone - savedHome.timezone) / 3600) * 10) / 10;
    const diffTemp = currentCityState.temp - savedHome.temp;

    const timeDiffDesc = diffHours === 0
        ? `與${savedHome.name}零時差`
        : (diffHours > 0 ? `比${savedHome.name}快 ${diffHours} 小時` : `比${savedHome.name}慢 ${Math.abs(diffHours)} 小時`);

    const tempDiffDesc = diffTemp === 0
        ? `氣溫與${savedHome.name}相同`
        : (diffTemp > 0 ? `比${savedHome.name}溫暖 ${diffTemp}°C` : `比${savedHome.name}涼爽 ${Math.abs(diffTemp)}°C`);

    homeCompareText.innerText = `${currentCityState.name}${timeDiffDesc}，${tempDiffDesc}，當地正值${currentCityState.period}。`;
    homeCompareText.style.display = "block";
}

// ==========================================
// 互動功能 4：世界氣候集章護照
// ==========================================
const passportToggleHeader = document.getElementById("passportToggleHeader");
const passportBody = document.getElementById("passportBody");
const passportToggleText = document.getElementById("passportToggleText");
const passportCount = document.getElementById("passportCount");
const passportStamps = document.getElementById("passportStamps");

passportToggleHeader.addEventListener("click", () => {
    const isHidden = passportBody.style.display === "none";
    passportBody.style.display = isHidden ? "block" : "none";
    passportToggleText.innerText = isHidden ? "收合足跡" : "展開足跡";
});

function recordCityStamp(cityName, englishName, temp, weatherDesc) {
    let stamps = JSON.parse(localStorage.getItem("weatherPassportStamps")) || [];
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getDate().toString().padStart(2, "0")}`;

    const existingIdx = stamps.findIndex(s => s.city === cityName);
    const stampRecord = {
        city: cityName,
        english: englishName,
        temp: temp,
        desc: weatherDesc,
        date: dateStr
    };

    if (existingIdx >= 0) {
        stamps[existingIdx] = stampRecord;
    } else {
        stamps.unshift(stampRecord);
    }

    localStorage.setItem("weatherPassportStamps", JSON.stringify(stamps));
    renderPassportStamps();
}

function renderPassportStamps() {
    let stamps = JSON.parse(localStorage.getItem("weatherPassportStamps")) || [];
    passportCount.innerText = stamps.length;

    if (stamps.length === 0) {
        passportStamps.innerHTML = `<span style="font-size:13px; color:#64748b;">尚未收集任何城市印章，試著搜尋或點擊「隨機」探索世界吧！</span>`;
        return;
    }

    passportStamps.innerHTML = stamps.map(s => `
        <button type="button" class="stamp-card" onclick="fetchWeather('${s.english || s.city}')" title="點擊傳送至${s.city}">
            <span class="stamp-city">${s.city} ${s.temp}°C</span>
            <span class="stamp-meta">${s.desc}・${s.date}</span>
        </button>
    `).join("");
}

// ==========================================
// 互動功能 2：一鍵生成並下載「明信片心情瓶」圖卡
// ==========================================
const exportPostcardBtn = document.getElementById("exportPostcardBtn");

exportPostcardBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 900, 540);
    if (currentCityState.weatherCondition === "Clear") {
        grad.addColorStop(0, "#1e3a8a");
        grad.addColorStop(1, "#3b82f6");
    } else if (currentCityState.weatherCondition === "Rain" || currentCityState.weatherCondition === "Drizzle") {
        grad.addColorStop(0, "#0f172a");
        grad.addColorStop(1, "#334155");
    } else {
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#475569");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 540);

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.beginPath();
    ctx.roundRect(36, 36, 828, 468, 24);
    ctx.fill();

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(54, 54, 792, 432);

    ctx.fillStyle = "#64748b";
    ctx.font = "20px 'DFKai-SB', '標楷體', serif";
    ctx.fillText("全球微型即時天氣心情瓶・跨時空氣候明信片", 82, 102);

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(650, 74, 170, 68);
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 18px 'DFKai-SB', '標楷體', serif";
    ctx.fillText(`當地時間 ${currentCityState.localTimeStr}`, 666, 103);
    ctx.font = "16px 'DFKai-SB', '標楷體', serif";
    ctx.fillText(`氣壓 ${currentCityState.pressure} hPa`, 666, 128);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 48px 'DFKai-SB', '標楷體', serif";
    ctx.fillText(`${currentCityState.name}`, 82, 185);

    const nameWidth = ctx.measureText(currentCityState.name).width;
    if (currentCityState.englishName && currentCityState.englishName.toLowerCase() !== currentCityState.name.toLowerCase()) {
        ctx.fillStyle = "#64748b";
        ctx.font = "26px 'DFKai-SB', '標楷體', serif";
        ctx.fillText(currentCityState.englishName, 98 + nameWidth, 185);
    }

    ctx.fillStyle = "#2563eb";
    ctx.font = "bold 38px 'DFKai-SB', '標楷體', serif";
    ctx.fillText(`${currentCityState.temp}°C ・ ${currentCityState.weatherDesc}`, 82, 242);

    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(82, 272);
    ctx.lineTo(818, 272);
    ctx.stroke();

    const typedInput = messageInput.value.trim();

    let cardContent = currentCityState.moodText;
    let cardLabel = "今日氣候小語：";

    if (typedInput) {
        cardContent = typedInput;
        cardLabel = `此刻心情（${selectedMoodTag}）：`;
    } else if (latestCloudCityMessages.length > 0) {
        const latest = latestCloudCityMessages[0];
        cardContent = latest.text;
        cardLabel = `雲端心情（${latest.tag}）：`;
    }

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 21px 'DFKai-SB', '標楷體', serif";
    ctx.fillText(cardLabel, 82, 314);

    ctx.fillStyle = "#1e293b";
    ctx.font = "24px 'DFKai-SB', '標楷體', serif";
    wrapCanvasText(ctx, cardContent, 82, 354, 730, 36);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "17px 'DFKai-SB', '標楷體', serif";
    ctx.fillText("輔仁大學醫資學程 第 1 組 | 全球微型即時天氣心情瓶", 82, 462);

    const link = document.createElement("a");
    link.download = `天氣心情瓶_${currentCityState.name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
});

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = "";
    let currentY = y;
    for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, x, currentY);
            line = text[i];
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
}

// ==========================================
// 7. 主查詢與畫面渲染流程 (支援經緯度直接查詢)
// ==========================================
async function fetchWeather(cityQuery) {
    const trimmedQuery = cityQuery.trim();
    if (!trimmedQuery) {
        alert("請輸入城市或國家名稱！");
        return;
    }

    const searchId = ++currentSearchId;
    moodMessage.innerText = "正在搜尋全球座標與即時氣候...";
    healthAdvice.innerText = "正在分析當地氣象生理指標...";
    resetSymptomUI();

    try {
        const location = await resolveLocation(trimmedQuery);
        if (searchId !== currentSearchId) return;

        if (!location) {
            throw new Error(`找不到「${trimmedQuery}」，請確認拼字或換個地區試試！`);
        }

        const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=metric&lang=zh_tw&appid=${API_KEY}`
        );

        if (!weatherResponse.ok) {
            throw new Error("無法取得該地區的氣象資料！");
        }

        const weatherData = await weatherResponse.json();
        if (searchId !== currentSearchId) return;

        await updateUI(weatherData, location, searchId);

    } catch (error) {
        if (searchId === currentSearchId) {
            alert(error.message);
            moodMessage.innerText = "請重新輸入有效的城市或國家名稱喔！";
        }
    }
}

async function fetchWeatherByCoords(lat, lon) {
    const searchId = ++currentSearchId;
    moodMessage.innerText = "正在透過GPS定位您的即時座標...";
    healthAdvice.innerText = "正在分析當地氣象生理指標...";
    resetSymptomUI();

    try {
        const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=zh_tw&appid=${API_KEY}`
        );

        if (!weatherResponse.ok) {
            throw new Error("無法取得您所在座標的氣象資料！");
        }

        const weatherData = await weatherResponse.json();
        if (searchId !== currentSearchId) return;

        let displayName = weatherData.name || "您的位置";
        let englishName = weatherData.name || "";

        try {
            const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-TW`;
            const revRes = await fetch(revUrl);
            if (revRes.ok) {
                const revData = await revRes.json();
                const addr = revData.address || {};
                const rawName = addr.city || addr.town || addr.district || addr.county || revData.display_name;
                if (rawName) {
                    displayName = toTraditionalChinese(rawName.split(",")[0]);
                }
            }
        } catch (e) {}

        const location = {
            lat: lat,
            lon: lon,
            displayName: displayName,
            englishName: englishName
        };

        await updateUI(weatherData, location, searchId);

    } catch (error) {
        if (searchId === currentSearchId) {
            alert(error.message);
            moodMessage.innerText = "定位失敗，請改用手動搜尋或點擊城市！";
        }
    }
}

async function updateUI(data, location, searchId) {
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const pressure = data.main.pressure;
    const weatherCondition = data.weather[0].main;
    const weatherDesc = toTraditionalChinese(data.weather[0].description);
    const iconCode = data.weather[0].icon;

    currentWeatherType = weatherCondition;
    const displayCityName = toTraditionalChinese(location.displayName);
    currentActiveCity = displayCityName;

    const finalEnglishName = location.englishName || data.name || "";

    if (isPlayingSound) {
        startWeatherSound(currentWeatherType);
    }

    const localTime = calculateLocalTimeInfo(data.timezone);
    localTimeDisplay.innerText = `當地時間 ${localTime.timeStr} ・ ${localTime.period}`;

    document.getElementById("cityNameDisplay").innerText = displayCityName;

    const cityEnglishEl = document.getElementById("cityEnglishDisplay");
    if (finalEnglishName && finalEnglishName.toLowerCase() !== displayCityName.toLowerCase()) {
        cityEnglishEl.innerText = finalEnglishName;
        cityEnglishEl.style.display = "inline";
    } else {
        cityEnglishEl.style.display = "none";
    }

    document.getElementById("tempDisplay").innerText = `${temp}°C`;
    document.getElementById("conditionDisplay").innerText = weatherDesc;
    document.getElementById("feelsLikeDisplay").innerText = `${feelsLike}°C`;
    document.getElementById("humidityDisplay").innerText = `${humidity}%`;
    document.getElementById("windDisplay").innerText = `${windSpeed} m/s`;
    document.getElementById("pressureDisplay").innerText = `${pressure} hPa`;

    const weatherIcon = document.getElementById("weatherIcon");
    weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    weatherIcon.style.display = "inline-block";

    const weatherFallbackBg = weatherBgDatabase[weatherCondition] || weatherBgDatabase["DEFAULT"];
    document.body.style.backgroundImage = `url('${weatherFallbackBg}')`;

    let landmarkUrl = landmarkDatabase[displayCityName] || landmarkDatabase[finalEnglishName];
    if (!landmarkUrl) {
        landmarkUrl = await fetchWikipediaImage(finalEnglishName);
    }
    if (searchId !== currentSearchId) return;

    if (landmarkUrl) {
        const imgLoader = new Image();
        imgLoader.onload = () => {
            if (searchId === currentSearchId) {
                document.body.style.backgroundImage = `url('${landmarkUrl}')`;
            }
        };
        imgLoader.src = landmarkUrl;
    }

    let themeClass = "cloudy-theme";
    let moodText = "";

    if (weatherCondition === "Clear") {
        themeClass = "sunny-theme";
        moodText = localTime.isNight
            ? `${displayCityName}現在是深夜 ${localTime.timeStr}，繁星點點、夜空晴朗，願你有個安穩的好夢。`
            : `${displayCityName}今天陽光普照，適合出去走走，感受這座城市的活力！`;
    } else if (weatherCondition === "Rain" || weatherCondition === "Drizzle" || weatherCondition === "Thunderstorm") {
        themeClass = "rainy-theme";
        moodText = localTime.isNight
            ? `${displayCityName}深夜正下著雨（${localTime.timeStr}），聽著雨滴敲打窗櫺，最適合泡杯熱茶放鬆思緒。`
            : `${displayCityName}外面正下著雨，帶把傘，在窗邊享受一杯熱咖啡的寧靜吧。`;
    } else if (weatherCondition === "Snow") {
        themeClass = "cloudy-theme";
        moodText = `${displayCityName}正在飄雪，記得添件保暖衣物，享受這片銀白世界的浪漫。`;
    } else {
        themeClass = "cloudy-theme";
        moodText = localTime.isNight
            ? `${displayCityName}已經來到 ${localTime.timeStr}，夜色微涼，忙碌了一天也別忘了給自己一個微笑。`
            : `${displayCityName}雲層有點厚，微風徐徐，是個適合沉思與專注的好天氣。`;
    }

    document.body.className = localTime.isNight ? `${themeClass} night-mode` : themeClass;
    moodMessage.innerText = moodText;

    healthAdvice.innerText = generateHealthAdvice(temp, humidity, pressure, weatherCondition);

    currentCityState = {
        name: displayCityName,
        englishName: finalEnglishName,
        temp: temp,
        humidity: humidity,
        pressure: pressure,
        weatherDesc: weatherDesc,
        weatherCondition: weatherCondition,
        timezone: data.timezone,
        localTimeStr: localTime.timeStr,
        period: localTime.period,
        moodText: moodText
    };

    updateHomeComparisonUI();
    recordCityStamp(displayCityName, finalEnglishName, temp, weatherDesc);

    msgCityTitle.innerText = displayCityName;
    await loadMessages();
}

// ==========================================
// 8. 雲端同步跨時空心情膠囊（Firebase Realtime Database）
// ==========================================
document.querySelectorAll(".mood-tag").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".mood-tag").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedMoodTag = btn.getAttribute("data-tag");
    });
});

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 統一城市名稱鍵值（避免「台北」與「臺北市」分開儲存）
function normalizeCityKey(cityName) {
    return cityName.replace(/臺/g, "台").trim();
}

async function saveAndRenderMessage() {
    const userMsg = messageInput.value.trim();
    if (!userMsg) return;

    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeStr = `${month}/${day} ${hours}:${minutes}`;

    const newEntry = {
        city: currentActiveCity,
        cityKey: normalizeCityKey(currentActiveCity),
        tag: selectedMoodTag,
        text: userMsg,
        time: timeStr,
        timestamp: Date.now()
    };

    postMsgBtn.disabled = true;
    postMsgBtn.innerText = "儲存中...";

    try {
        const res = await fetch(`${FIREBASE_DB_URL}/capsules.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEntry)
        });

        if (!res.ok) {
            throw new Error("雲端儲存失敗，請確認 Firebase 規則是否已設為測試模式。");
        }

        messageInput.value = "";
        await loadMessages();
    } catch (err) {
        alert(err.message);
    } finally {
        postMsgBtn.disabled = false;
        postMsgBtn.innerText = "儲存";
    }
}

async function loadMessages() {
    const targetCity = currentActiveCity;
    const targetKey = normalizeCityKey(targetCity);
    messageList.innerHTML = `<li style="justify-content:center; color:#64748b;">正在讀取「${targetCity}」的雲端歷史膠囊...</li>`;

    try {
        const res = await fetch(`${FIREBASE_DB_URL}/capsules.json`);
        if (!res.ok) throw new Error("無法連線至雲端資料庫");

        const data = await res.json();
        if (targetCity !== currentActiveCity) return;

        let allMessages = [];
        if (data) {
            allMessages = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        }

        const cityMessages = allMessages
            .filter(msg => (msg.cityKey || normalizeCityKey(msg.city || "")) === targetKey)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        latestCloudCityMessages = cityMessages;

        if (cityMessages.length === 0) {
            messageList.innerHTML = `<li style="justify-content:center; color:#64748b;">目前還沒有人留給「${targetCity}」的膠囊，搶先寫下第一則吧！</li>`;
            return;
        }

        messageList.innerHTML = cityMessages.map(msg => {
            const safeTag = escapeHTML((msg.tag || "愜意").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "") || "愜意");
            const safeTime = escapeHTML(msg.time || "");
            const safeText = escapeHTML(msg.text || "");
            return `
                <li>
                    <div class="msg-content">
                        <div class="msg-meta">
                            <span class="msg-tag-badge">${safeTag}</span>
                            <span class="msg-time">留存於 ${safeTime}</span>
                        </div>
                        <span>${safeText}</span>
                    </div>
                </li>
            `;
        }).join("");
    } catch (err) {
        if (targetCity === currentActiveCity) {
            messageList.innerHTML = `<li style="justify-content:center; color:#ef4444;">雲端留言載入失敗，請檢查網路或資料庫權限。</li>`;
        }
    }
}

// ==========================================
// 9. 事件監聽綁定
// ==========================================
searchBtn.addEventListener("click", () => fetchWeather(cityInput.value));
cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") fetchWeather(cityInput.value);
});

geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("您的瀏覽器不支援地理定位功能！");
        return;
    }
    moodMessage.innerText = "正在取得您的 GPS 定位授權...";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeatherByCoords(lat, lon);
        },
        (error) => {
            alert("無法取得您的定位，請確認是否已授權瀏覽器存取位置。");
            moodMessage.innerText = "定位失敗，請改用手動搜尋或點擊城市！";
        },
        { timeout: 10000 }
    );
});

randomBtn.addEventListener("click", () => {
    const randomCity = randomDestinations[Math.floor(Math.random() * randomDestinations.length)];
    cityInput.value = randomCity;
    fetchWeather(randomCity);
});

document.querySelectorAll(".city-chip").forEach(btn => {
    btn.addEventListener("click", () => {
        const city = btn.getAttribute("data-city");
        cityInput.value = city;
        fetchWeather(city);
    });
});

postMsgBtn.addEventListener("click", saveAndRenderMessage);
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") saveAndRenderMessage();
});

window.addEventListener("DOMContentLoaded", () => {
    renderPassportStamps();
    fetchWeather("台北");
});
