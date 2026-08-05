let audioContext;
let soundBuffers = {};
let isAudioReady = false;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

async function loadSound(name, url) {
    const ctx = initAudio();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    soundBuffers[name] = audioBuffer;
}

// Список звуков: имя → путь
const soundsToLoad = {
    clicker: 'assets/sounds/coin-click.mp3',
    buy: 'assets/sounds/buy-item.mp3',
    box_open: 'assets/sounds/box_open.ogg',
    menu_click: 'assets/sounds/menu_click.ogg',
    brawler_card: 'assets/sounds/brawler_card.ogg',
    new_level: 'assets/sounds/new_level.ogg',
};

// Загружаем все параллельно
Promise.all(
    Object.entries(soundsToLoad).map(([name, url]) => loadSound(name, url))
).then(() => {
    console.log('Все звуки загружены');
    isAudioReady = true;
}).catch(err => console.warn('Ошибка загрузки звуков:', err));

function playSound(name) {
    const buffer = soundBuffers[name];
    if (!buffer) {
        console.warn(`Звук "${name}" не найден или не загружен`);
        return;
    }
    const ctx = initAudio();
    // Если контекст в режиме suspended, активируем его
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
}


// Объект прогресса по умолчанию (для нового игрока)
let playerProgress = {
    score: 0,
    clickPower: 1,
    autoclick: 0,
    unlockedBrawlers: [],
    lastUpgrade: 0,
    totalClicks: 0
};

/** @type {import('ysdk').SDK | null} */
let ysdk = null;

/** @type {import('ysdk').Player | null} */
let player = null;

async function initSDK() {
    try {
        ysdk = await YaGames.init();
        player = await ysdk.getPlayer();

        await loadPlayerProgress();
    } catch {
        loadLocalStorage();
        console.log("Игра запущена не на Яндекс Играх")
    }
}

async function loadPlayerProgress(){
    const numericData = await player.getStats();
    const arrayData = await player.getData(["unlockedBrawlers"]);
    const cloudData = {
        ...numericData,
        unlockedBrawlers: (arrayData && arrayData.unlockedBrawlers) ? arrayData.unlockedBrawlers : []
    }

    const localJSON = localStorage.getItem("brawl_stars_clicker_save");
    const localData = JSON.parse(localJSON)

    if (cloudData){
        playerProgress = cloudData;
    } else if (localData){
        playerProgress = localData;
    }

    console.log(playerProgress)

    applyLoadedData();
}

function saveGame() { 
    try { 
        console.log(playerProgress)
        const progressString = JSON.stringify(playerProgress); 
        localStorage.setItem("brawl_stars_clicker_save", progressString); 
    } catch (error) { 
        console.warn("Ошибка сохранения:", error); 
    } 
}

function loadLocalStorage(){
    const localJSON = localStorage.getItem("brawl_stars_clicker_save");
    const localData = JSON.parse(localJSON)
    if (localData){
        playerProgress = localData;
    }

    applyLoadedData();
}

async function SDKsaveGame(){
    const {unlockedBrawlers, ...numericData} = playerProgress;
    await player.setStats(numericData).then(()=>{console.log(playerProgress)});
}

const CLICKS_PER_LEVEL_STEP = 50;
let currentLevel = 1;
const levelImg = document.getElementById("level-img")
const shopItems = document.querySelectorAll('.shop-item');
let autoInterval = null;
const brawlers = ["shelly", "el-primo", "bibi", "mortis", "leon"]
const clicker = document.getElementById("coin");
const trophyCount = document.getElementById('score');
const brawlerCards = document.querySelectorAll(".brawler-card")

function applyLoadedData(){
    trophyCount.textContent = to_coroche(playerProgress.score);
    if (playerProgress.autoclick > 0){
        autoInterval = setInterval(addAutoTrophy, 1000);
    }
    for (let i = 0; i <= playerProgress.lastUpgrade; i++){
        shopItems[i].classList.remove("closed")
    }

    currentLevel = calculateLevelData(playerProgress.totalClicks).level;
    updateProgressBarUI();
    updateBrawlerCardUI();

    if (ysdk && player){
        if (isAudioReady){
            let updateDataInt = setInterval(SDKsaveGame, 3000)
            ysdk.features.LoadingAPI.ready();
        }
    }
}

initSDK();

function calculateLevelData(clicks) {
    let level = 1;
    let clicksRequiredForCurrent = 50;
    let accumulatedClicks = 0;

    // Цикл быстро находит текущий уровень игрока
    while (clicks >= accumulatedClicks + (level * CLICKS_PER_LEVEL_STEP)) {
        accumulatedClicks += level * CLICKS_PER_LEVEL_STEP;
        level++;
    }

    clicksRequiredForCurrent = level * CLICKS_PER_LEVEL_STEP;
    const clicksInCurrentLevel = clicks - accumulatedClicks;

    return {
        level: level,
        current: clicksInCurrentLevel,
        required: clicksRequiredForCurrent
    };
}

function updateProgressBarUI() {
    const data = calculateLevelData(playerProgress.totalClicks);
    
    const percent = (data.current / data.required) * 100;
    levelImg.setAttribute("src", `assets/ranked/level_${Math.min(data.level, 8)}.png`)

    if (data.level > currentLevel){
        playSound("new_level");
        let bonus = currentLevel * CLICKS_PER_LEVEL_STEP * playerProgress.clickPower;
        addTrophy(bonus)
        createFloatingText(headerCenterX, headerCenterY, `+${to_coroche(bonus)}`, "bonus")
        currentLevel = data.level;
    }

    document.getElementById("level-title").textContent = `Уровень ${data.level}`;
    document.getElementById("progress-fill").style.width = `${percent}%`;
}

const mainHeader = document.getElementById("clicker-header");
const headerRect = mainHeader.getBoundingClientRect();
const headerCenterX = headerRect.left + headerRect.width / 2;
const headerCenterY = headerRect.top + headerRect.height / 2;

function checkShopButtons() {
    shopItems.forEach(item => {
        const price = parseInt(item.dataset.price);
        if (price > playerProgress.score){
            item.classList.add("disabled")
        } else if (item.classList.contains("disabled")) {
            item.classList.remove("disabled")
        }
    });
}

function addAutoTrophy() {
    playerProgress.score += playerProgress.autoclick;
    // saveGame();

    trophyCount.textContent = to_coroche(playerProgress.score);
    checkShopButtons();
}

function addTrophy(value) {
    playerProgress.score += value;
    saveGame();

    trophyCount.textContent = to_coroche(playerProgress.score);
    checkShopButtons();
}

// Покупка товара
function buyItem(itemType, value, price) {
    if (itemType === 'autoclick') {
        if (playerProgress.score < price) return;

        playerProgress.autoclick += value;
        // если интервал ещё не запущен, запускаем
        if (!autoInterval) {
            autoInterval = setInterval(addAutoTrophy, 1000);
        }
    } else if (itemType === 'cursor') {
        if (playerProgress.score < price) return;

        playerProgress.clickPower += value;
    }

    let lost = -1 * price;
    if (playerProgress.unlockedBrawlers.includes("mortis")){
        lost += price * 0.1
    }
    addTrophy(lost);
    playSound("buy");

    //Визуально отмечаем сколько потратили
    createFloatingText(headerCenterX, headerCenterY, `-${to_coroche(lost * -1)}`, "waste")
}

// Обработчики кнопок магазина
shopItems.forEach((item, index)  => {
    item.addEventListener('click', function(e) {
        e.stopPropagation(); // чтобы не кликать монету случайно
        if (item.classList.contains("disabled") || item.classList.contains("closed")) {return; }

        if (index + 1 < shopItems.length){
            const nextItem = shopItems[index + 1];
            nextItem.classList.remove("closed")
            playerProgress.lastUpgrade = Math.max(playerProgress.lastUpgrade, index + 1);
        }

        const itemData = this.dataset.item;
        const price = parseInt(this.dataset.price);

        const [itemType, strValue] = itemData.split("-");
        const value = parseInt(strValue);

        buyItem(itemType, value, price);
    });
});


const ClickerRect = clicker.getBoundingClientRect();
const centerX = ClickerRect.left + ClickerRect.width / 2;
const centerY = ClickerRect.top + ClickerRect.height / 2;

clicker.addEventListener("click", function(e) {
    e.preventDefault();

    let textClass = undefined;
    let boostedClick = playerProgress.clickPower;
    if (playerProgress.unlockedBrawlers.includes("shelly")){
        if (playerProgress.totalClicks % 10 === 0){
            boostedClick += 10;
        }
    }
    if (playerProgress.unlockedBrawlers.includes("bibi")){
        if (Math.random() <= 0.15){
            boostedClick *= 5;
        }
    }
    if (trophyRainInt){
        boostedClick *= 2;
        textClass = "rain"
    }

    addTrophy(boostedClick)
    
    playSound("clicker")
    
    createTrophyBurst(centerX, centerY);
    createFloatingText(e.clientX, e.clientY, `+${to_coroche(boostedClick)}`, textClass);

    let levelPower = 1;
    if (playerProgress.unlockedBrawlers.includes("el-primo")){
        levelPower *= 2;
    }
    playerProgress.totalClicks += levelPower;
    updateProgressBarUI();
});


const particlesContainer = document.getElementById('particles-container');
const trophy_IMG = 'assets/icons/trophy_icon.png';

function createTrophyBurst(x, y) {
    const count = 4; // количество частиц
    const spread = 150; // разлёт в пикселях

    for (let i = 0; i < count; i++) {
        // Создаём элемент частицы
        const particle = document.createElement('img');
        particle.className = 'trophy-particle';
        particle.src = trophy_IMG;
        particle.alt = '🏆';
        
        particle.style.left = (x - 20) + 'px';   // смещаем на половину ширины
        particle.style.top = (y - 20) + 'px';

        const size = 30 + Math.random() * 60; 
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // Случайное направление и расстояние
        const angle = Math.random() * 2 * Math.PI;
        const distance = 50 + Math.random() * spread;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance - 30; // небольшой подброс вверх
        
        // Случайный поворот от -720 до 720 градусов (2 оборота)
        const rotation = (Math.random() - 0.5) * 720;
        
        // Устанавливаем CSS-переменные для использования в анимации
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.setProperty('--rot', rotation + 'deg');
        
        // Добавляем в контейнер
        particlesContainer.appendChild(particle);
        particle.classList.add('animate');
        
        // Удаляем элемент после завершения анимации
        particle.addEventListener('animationend', () => {
            particle.remove();
        });
    }
}

function createFloatingText(x, y, text, style) {
    let exist_els = document.querySelectorAll(".float-text");

    if (exist_els.length > 2){
        exist_els[0].remove();
    }

    const el = document.createElement('div');
    el.className = 'float-text';
    el.classList.add(style)

    el.textContent = text;
    el.style.left = (x - 20) + 'px';
    el.style.top = (y - 20) + 'px';

    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

const boostContainer = document.getElementById("boost-container");
const timerValue = document.getElementById("timer-value");
const delayTime = 120
let trophyRainInt = null;
let updateBoostTimer = setInterval(() => {
    let newTimer = Number(timerValue.dataset.item) - 1;
    
    if (newTimer === -1) {
        // Переключаем класс на главном контейнере!
        boostContainer.classList.toggle("active");
        
        if (boostContainer.classList.contains("active")) {
            newTimer = 10;
            trophyRainInt = setInterval(trophyRain, 300);
        } else {
            newTimer = 120;
            clearInterval(trophyRainInt)
            trophyRainInt = null;
        }
    }
    
    timerValue.dataset.item = newTimer;
    
    const minutes = Math.floor(newTimer / 60);
    const seconds = String(newTimer % 60).padStart(2, '0');
    timerValue.textContent = `${minutes}:${seconds}`;
}, 1000);

const mainPage = document.getElementById("main-content")
function trophyRain(){
    const trophy = document.createElement("img")
    trophy.src = trophy_IMG;
    trophy.alt = '🏆'

    trophy.style.left = Math.random() * (mainPage.clientWidth - 80) + 'px'

    trophy.style.setProperty("--lifetime", Math.random() * 2 + 1 + 's')
    trophy.style.setProperty("--ty", Math.random() * (document.body.clientHeight - 280) + 200 + 'px')
    trophy.style.setProperty("--angle", Math.random() * 720 - 360 + 'deg')

    trophy.classList.add("rainy");

    mainPage.appendChild(trophy);

    trophy.addEventListener("animationend", function(){
        trophy.remove();
    })
}

// ===== Модальное окно магазина бравлеров =====
const boxCards = document.querySelectorAll(".box-card");
const boxShops = document.querySelectorAll('.shop');
const buyBoxes = document.querySelectorAll(".buy-box")

boxCards.forEach((btn, idx) => {
    btn.addEventListener('click', function(){
        boxShops[idx].classList.add('active');
        document.body.style.overflow = 'hidden'; // запрещаем скролл страницы

        playSound("menu_click");

        buyBoxes.forEach((buyBtn) => {
            if (parseInt(buyBtn.dataset.price) > playerProgress.score){
                buyBtn.classList.add("disabled")
            } else if (buyBtn.classList.contains("disabled")) {
                buyBtn.classList.remove("disabled")
            }
        })

    });
})

// Функция закрытия модального окна
function closeShop(idx) {
    boxShops[idx].classList.remove('active');
    document.body.style.overflow = ''; // возвращаем скролл

    setTimeout(() => {
        brawlerCards.forEach(card => {
            card.classList.remove("flipped")
        });
    }, 70)

    playSound("menu_click");
}

const modalCloseBtn = document.querySelectorAll('.close-shop');
modalCloseBtn.forEach((btn, idx) => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation(); // чтобы не закрыть дважды
        closeShop(idx);
    });
})

document.addEventListener("click", function(e) {
    boxShops.forEach((shop, idx) => {
        if (shop.classList.contains("active")) {
            
            // Магия геймдева: метод e.target.closest() проверяет, 
            // был ли клик сделан внутри самого окна или по кнопке, которая его открывает
            console.log(shop.id, boxCards[idx].id)
            const isClickInsideShop = e.target.closest(`#${shop.id}`);
            const isClickOnOpenBtn = e.target.closest(`#${boxCards[idx].id}`); // Кнопка/карточка, которая открывает это окно

            // Если клик был за пределами окна И не по кнопке открытия — закрываем!
            if (!isClickInsideShop && !isClickOnOpenBtn) {
                shop.classList.remove("active");
                playSound("menu_click"); // Включаем приятный звук закрытия меню
            }
        }
    })
});

// Закрытие по клавише Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalShop.classList.contains('active')) {
        closeModal();
    }
});

brawlerCards.forEach(card => {
    card.addEventListener("click", function(e){
        this.classList.toggle("flipped");
        playSound("brawler_card")
    })
})

// Открытие обычного ящика
const loodContainer = document.getElementById("lood")
const loodInfo = loodContainer.querySelector("p")
buyBoxes[0].addEventListener('click', function(e){
    if (parseInt(this.dataset.price) > playerProgress.score){return; }
    loodContainer.classList.add("active")
    boxShops[0].classList.remove("active")
    playSound("buy")

    if (Math.random() < 0.5){
        loodInfo.textContent = "Неудача! -1000 кубков"
        addTrophy(-1000)
    } else{
        loodInfo.textContent = "Успех! +2000 кубков"
        addTrophy(1000)
    }
})

loodContainer.addEventListener("click", function(e){
    e.preventDefault()
    loodContainer.classList.remove("active")
})
// Открытие мегаящика
const megaboxUnlocking = document.getElementById("megabox-unlocking");
buyBoxes[1].addEventListener('click', function(e){
    if (parseInt(this.dataset.price) > playerProgress.score){return; }
    megaboxUnlocking.classList.add("active");
    playSound("buy");

    addTrophy(-1 * parseInt(this.dataset.price) )
});

const megaboxImg = megaboxUnlocking.querySelector(".megabox-img");

const unlockingModal = document.querySelector(".modal-overlay");
const unlockingVideo = unlockingModal.querySelector(".modal-bg-video")
const openedBrawler = unlockingModal.querySelector(".modal-brawler-image");

const brawlerDescriptions = {
    "shelly": "Стартовый классический боец! Сильный дробовик позволяет прибавлять к каждому 10 клику +10 мощи",
    "el-primo": "Го го го! Мощный мексиканский боец сокрушает рекорды: удваивает скорость поднятия уровня",
    "bibi": "Разгон на полную! Своей бейсбольной битой Биби дарит шанс 15% умножить силу клику в 5 раз",
    "mortis": "Бесконечная ульта Мортиса! Летучие мыши крадут цены в магазине и возвращают кэшбек 10% при покупке",
    "leon": "Абсолютная невидимость и мощь! Легендарный Леон уменьшает время усиления кубков до 1 минуты"
}

const probability = [0.35, 0.6, 0.8, 0.98, 1]
const descriptionDiv = document.getElementById("brawler-desc")

megaboxUnlocking.addEventListener("click", function(e){
    e.preventDefault();
    resetAnimation();
    unlockingModal.removeEventListener("click", resetAnimation)

    megaboxImg.classList.remove("bouncing")

    playSound("box_open");

    unlockingVideo.muted = false;
    unlockingVideo.play();
    unlockingModal.classList.add("active")

    let brawler_idx = Math.random()
    for (let i = 0; i < probability.length; i++){
        if (brawler_idx < probability[i]){
            brawler_idx = i;
            break;
        }
    }

    const brawlerName = brawlers[brawler_idx];
    if (!playerProgress.unlockedBrawlers.includes(brawlerName)){
        playerProgress.unlockedBrawlers.push(brawlerName);
        saveGame();
    }
    openedBrawler.setAttribute("src", `assets/brawler-models/${brawlerName}_model.png`)
    openedBrawler.setAttribute("alt", `${brawlerName}`)

    descriptionDiv.children[0].textContent = brawlerName
    descriptionDiv.children[1].textContent = brawlerDescriptions[brawlerName]

    megaboxUnlocking.classList.remove("active")
})

const brawlerWrapper = unlockingModal.querySelector(".brawler-wrapper")

function resetAnimation(e){
    unlockingModal.classList.remove("active");
    brawlerWrapper.classList.remove("unlocked")
    descriptionDiv.classList.remove("unlocked")
    megaboxImg.setAttribute("src", "assets/megabox.png")
    megaboxImg.classList.add("bouncing");
    unlockingVideo.classList.remove("hidden");

    updateBrawlerCardUI();
}

unlockingVideo.addEventListener("ended", function(){
    unlockingVideo.classList.add("hidden");
    setTimeout(() => {unlockingModal.addEventListener("click", resetAnimation)}, 1100)

    brawlerWrapper.classList.add("unlocked")
    descriptionDiv.classList.add("unlocked")
})


/**
 * @param {number} n - Первое слагаемое
 */
function to_coroche(n){
    // Если число отрицательное, сохраняем знак для корректного списания (например, -100)
    const sign = n < 0 ? "-" : "";
    const num = Math.abs(n);

    if (num < 1000) return sign + num;

    const suffixes = ["", "K", "M", "B", "T", "S", "Se", "++"];
    
    // Магическая формула геймдева: определяет индекс сокращения через логарифм по базе 1000
    let i = Math.floor(Math.log10(num) / 3);
    
    const shortValue = num / Math.pow(1000, i);
    
    const finalNumber = Math.floor(shortValue * 10) / 10;
    i = Math.min(i, suffixes.length)

    return sign + finalNumber + suffixes[i];
}

const navButtons = document.querySelectorAll('#mobile-nav button');

navButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        // Убираем активный класс у всех кнопок
        navButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        boxShops.forEach((shop) => {
            if (shop.classList.contains("active")){
                shop.classList.remove("active")
            }
        }) 
        // Показываем нужный раздел
        const section = this.dataset.section;
        switchSection(section);

        playSound("menu_click");

    });
});

function switchSection(section) {
    // Скрываем все секции
    const flyingTrophies = [...document.querySelectorAll(".rainy"), ...document.querySelectorAll(".trophy-particle")];
    
    // Насильно удаляем их из памяти, чтобы они не зависали в display:none
    flyingTrophies.forEach(trophy => trophy.remove());

    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    
    // Показываем нужную
    const target = document.getElementById(section);
    if (target) target.style.display = 'flex';
}

function updateBrawlerCardUI(){
    for (let name of playerProgress.unlockedBrawlers){
        const brawlerIndex = brawlers.indexOf(name);
        const brawlerImg = brawlerCards[brawlerIndex].querySelector(".brawler-img")
        if (!brawlerImg.classList.contains("unlocked")){
            brawlerImg.classList.add("unlocked");
        }
    }
}

if (window.location.search.includes("reset=true")) {
    localStorage.removeItem("brawl_stars_clicker_save");
    window.location.href = window.location.origin + window.location.pathname; // очищаем ссылку
}

