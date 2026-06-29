// Получаем монету
const clicker = document.getElementById("coin");
const trophyCount = document.getElementById('score');
const coinSound = document.getElementById("coin-sound");

// Создаём контейнер для частиц, если его нет
let particlesContainer = document.getElementById('particles-container');
if (!particlesContainer) {
    particlesContainer = document.createElement('div');
    particlesContainer.id = 'particles-container';
    document.body.appendChild(particlesContainer);
}

// Путь к картинке трофея (или используйте эмодзи)
const TROPHY_IMG = 'assets/trophy.png';

// Функция создания взрыва трофеев
function createTrophyBurst(x, y) {
    const count = 4; // количество частиц
    const spread = 150; // разлёт в пикселях

    for (let i = 0; i < count; i++) {
        // Создаём элемент частицы
        const particle = document.createElement('img');
        particle.className = 'trophy-particle';
        particle.src = TROPHY_IMG;
        particle.alt = '🏆';
        
        // Начальная позиция – центр монеты (относительно контейнера)
        // Для точности можно вычислить координаты монеты на экране
        // Но проще позиционировать относительно тела страницы.
        // Поскольку контейнер fixed, используем абсолютные координаты клика.
        particle.style.left = (x - 20) + 'px';   // смещаем на половину ширины
        particle.style.top = (y - 20) + 'px';

        const size = 30 + Math.random() * 60; // от 30 до 90px
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
        
        // Запускаем анимацию с небольшой задержкой (для разнообразия)
        const delay = Math.random() * 0.1; // 0–0.1с
        setTimeout(() => {
            particle.classList.add('animate');
        }, delay * 1000);
        
        // Удаляем элемент после завершения анимации
        particle.addEventListener('animationend', () => {
            particle.remove();
        });
    }
}

function createFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = (x - 20) + 'px';
    el.style.top = (y - 20) + 'px';
    // случайное смещение влево-вправо для красоты
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.setProperty('--offsetX', offsetX + 'px');
    // можно добавить вращение, но не обязательно
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}


// ===== МАГАЗИН =====
// Переменные валют и бонусов
let trophy = parseInt(trophyCount.textContent);
let clickPower = 1;        // за клик
let autoIncome = 0;        // в секунду
let autoInterval = null;

const buyBtns = document.querySelectorAll('.buy-btn');

function checkShopButtons() {
    const currentScore = parseInt(trophyCount.textContent);

    buyBtns.forEach(btn => {
        const price = parseInt(btn.textContent.match(/\d+/)[0]);
        console.log(price)
        btn.disabled = (price > currentScore);
    });
}

function addAutoTrophy() {
    const currentScore = parseInt(trophyCount.textContent);
    trophyCount.textContent = currentScore + autoIncome;
    checkShopButtons();
}

// Покупка товара
function buyItem(itemType) {
    const currentScore = parseInt(trophyCount.textContent);
    let price = 0;

    if (itemType === 'autoclick') {
        price = 20;
        if (currentScore < price) return;

        autoIncome += 1;
        // если интервал ещё не запущен, запускаем
        if (!autoInterval) {
            autoInterval = setInterval(addAutoTrophy, 1000);
        }
    } else if (itemType === 'cursor') {
        price = 100;
        if (currentScore < price) return;

        clickPower += 1;
    }

    trophyCount.textContent = currentScore - price;
    checkShopButtons();
}

// Обработчики кнопок магазина
buyBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation(); // чтобы не кликать монету случайно
        const item = this.dataset.item;
        buyItem(item);
    });
});

// Переопределяем обработчик клика по монете, чтобы добавить молоко и бонусный клик
// Сохраняем старый обработчик, если он уже был, и добавляем новый
// Заменяем старый addEventListener на новый, который включает и молоко, и бонусы

// Сначала удалим старый обработчик (если он был привязан через named function)
// Мы переопределим клик заново:
clicker.removeEventListener('click', null); // если был анонимный, лучше заменить
// Привязываем новый обработчик
clicker.addEventListener("click", function(e) {
    const currentScore = Number(trophyCount.textContent);
    trophyCount.textContent = currentScore + clickPower;

    checkShopButtons();
    
    if (coinSound) {
        coinSound.currentTime = 0;
        coinSound.playbackRate = 0.75;
        coinSound.play().catch(() => {});
    }
    
    const rect = clicker.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    createTrophyBurst(centerX, centerY);
});

checkShopButtons();