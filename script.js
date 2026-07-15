let audioContext;
let soundBuffers = {};

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
    console.log(`Звук "${name}" загружен`);
}

// Список звуков: имя → путь
const soundsToLoad = {
    clicker: 'assets/sounds/coin-click.mp3',
    buy: 'assets/sounds/buy-item.mp3',
    box_open: 'assets/sounds/box_open.ogg',
    menu_click: 'assets/sounds/menu_click.ogg',
    brawler_card: 'assets/sounds/brawler_card.ogg',
    new_level: 'assets/sounds/new_level.ogg'
};

// Загружаем все параллельно
Promise.all(
    Object.entries(soundsToLoad).map(([name, url]) => loadSound(name, url))
).then(() => {
    console.log('Все звуки загружены');
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

function saveGame() {
    try {
        // Конвертируем объект в JSON-строку
        const progressString = JSON.stringify(playerProgress);

        localStorage.setItem("brawl_stars_clicker_save", progressString);
        
        console.log("Игра успешно сохранена!");
    } catch (error) {
        // На случай, если у игрока включен режим инкогнито и localStorage заблокирован
        console.warn("Не удалось сохранить игру в localStorage:", error);
    }
}

function loadGame() {
    // Пытаемся достать строку из памяти браузера
    const savedData = localStorage.getItem("brawl_stars_clicker_save");
    
    if (savedData) {
        try {
            // Превращаем строку обратно в объект
            playerProgress = JSON.parse(savedData);
            playerProgress = {
    score: 10000,
    clickPower: 1333333,
    autoclick: 0,
    unlockedBrawlers: [],
    lastUpgrade: 0,
    totalClicks: 1020
};
saveGame();

            trophyCount.textContent = to_coroche(playerProgress.score);
            if (playerProgress.autoclick > 0){
                timer = 1000
                if (playerProgress.unlockedBrawlers.includes("leon")){
                    timer = 500;
                }
                autoInterval = setInterval(addAutoTrophy, timer);
            }
            for (let i = 0; i <= playerProgress.lastUpgrade; i++){
                shopItems[i].classList.remove("closed")
            }

            currentLevel = calculateLevelData(playerProgress.totalClicks).level;
            updateProgressBarUI();
            updateBrawlerCardUI();

        } catch (error) {
            console.error("Файл сохранений поврежден, сброс прогресса:", error);
        }
    } else {
        console.log("Сохранений не найдено. Начинаем новую игру!");
    }
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

loadGame();
checkShopButtons();

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
    saveGame();

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
            saveGame();
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
    addTrophy(boostedClick)
    
    playSound("clicker")
    
    createTrophyBurst(centerX, centerY);
    createFloatingText(e.clientX, e.clientY, `+${to_coroche(boostedClick)}`);

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


// ===== Модальное окно магазина бравлеров =====
const modalShop = document.getElementById('megabox-shop');
const modalCloseBtn = document.getElementById('modal-close');
const megaboxCard = document.getElementById('megabox-card');
const brawlerBtn = document.getElementById("buy-brawler")

megaboxCard.addEventListener('click', function(){
    modalShop.classList.add('active');
    document.body.style.overflow = 'hidden'; // запрещаем скролл страницы

    playSound("menu_click");
    if (parseInt(brawlerBtn.dataset.price) > playerProgress.score){
        brawlerBtn.classList.add("disabled")
    } else if (brawlerBtn.classList.contains("disabled")) {
        brawlerBtn.classList.remove("disabled")
    }
});

// Функция закрытия модального окна
function closeModal() {
    modalShop.classList.remove('active');
    document.body.style.overflow = ''; // возвращаем скролл

    setTimeout(() => {
        brawlerCards.forEach(card => {
            card.classList.remove("flipped")
        });
    }, 70)

    playSound("menu_click");
}

// Закрытие по клику на крестик
modalCloseBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // чтобы не закрыть дважды
    closeModal();
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

// Открытие мегаящика
const megaboxUnlocking = document.getElementById("megabox-unlocking");
brawlerBtn.addEventListener('click', function(e){
    if (parseInt(brawlerBtn.dataset.price) > playerProgress.score){return; }
    megaboxUnlocking.classList.add("active");
    playSound("buy");

    addTrophy(-1 * parseInt(brawlerBtn.dataset.price) )
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
    "leon": "Абсолютная невидимость и мощь! Легендарный Леон позволяет автоклику зарабатывать каждые полсекунды!"
}

const probability = [0.35, 0.6, 0.8, 0.98, 1]
const descriptionDiv = document.getElementById("brawler-desc")

megaboxUnlocking.addEventListener("click", function(e){
    e.preventDefault();
    resetAnimation();
    unlockingModal.removeEventListener("click", resetAnimation)

    megaboxImg.setAttribute("src", "assets/megabox_opened.png")
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
    if (brawlerName === "leon" && !playerProgress.unlockedBrawlers.includes("leon")){
        clearInterval(autoInterval);
        autoInterval = setInterval(addAutoTrophy, 500)
    }
    if (!playerProgress.unlockedBrawlers.includes(brawlerName)){
        playerProgress.unlockedBrawlers.push(brawlerName);
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

    const suffixes = ["", "K", "M", "B"];
    
    // Магическая формула геймдева: определяет индекс сокращения через логарифм по базе 1000
    const i = Math.floor(Math.log10(num) / 3);
    
    const shortValue = num / Math.pow(1000, i);
    
    const finalNumber = Math.floor(shortValue * 10) / 10;
    console.log(shortValue, finalNumber, num)

    return sign + finalNumber + suffixes[i];
}

const navButtons = document.querySelectorAll('#mobile-nav button');

navButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        // Убираем активный класс у всех кнопок
        navButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        if (modalShop.classList.contains("active")){
            modalShop.classList.remove("active")
        }

        // Показываем нужный раздел
        const section = this.dataset.section;
        switchSection(section);

        playSound("menu_click");

    });
});

function switchSection(section) {
    // Скрываем все секции
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