const cardsContainer = document.getElementById('cards');
const timeframeButtons = document.querySelectorAll('.time-btn');


const data = [
  {
    title: 'Work',
    timeframes: {
      daily: { current: 5, previous: 7 },
      weekly: { current: 32, previous: 36 },
      monthly: { current: 103, previous: 128 }
    }
  },
  {
    title: 'Play',
    timeframes: {
      daily: { current: 1, previous: 2 },
      weekly: { current: 10, previous: 8 },
      monthly: { current: 23, previous: 29 }
    }
  },
  {
    title: 'Study',
    timeframes: {
      daily: { current: 0, previous: 1 },
      weekly: { current: 4, previous: 7 },
      monthly: { current: 13, previous: 19 }
    }
  },
  {
    title: 'Exercise',
    timeframes: {
      daily: { current: 1, previous: 1 },
      weekly: { current: 4, previous: 5 },
      monthly: { current: 11, previous: 18 }
    }
  },
  {
    title: 'Social',
    timeframes: {
      daily: { current: 1, previous: 3 },
      weekly: { current: 5, previous: 10 },
      monthly: { current: 21, previous: 23 }
    }
  },
  {
    title: 'Self Care',
    timeframes: {
      daily: { current: 0, previous: 1 },
      weekly: { current: 2, previous: 2 },
      monthly: { current: 7, previous: 11 }
    }
  }
];

function renderCards(period) {
  cardsContainer.innerHTML = '';

  data.forEach(item => {
    const { title, timeframes } = item;
    const current = timeframes[period].current;
    const previous = timeframes[period].previous;
    const prevText =
      period === 'daily' ? 'Yesterday' :
      period === 'weekly' ? 'Last Week' :
      'Last Month';

    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--bg-color', getCategoryColor(title));

    card.innerHTML = `
      <div class="card-top"></div>
      <div class="card-content">
        <div class="card-header">
          <h2 class="card-title">${title}</h2>
          <span class="ellipsis">•••</span>
        </div>
        <div>
          <div class="current">${current}hrs</div>
          <div class="previous">${prevText} - ${previous}hrs</div>
        </div>
      </div>
    `;

    cardsContainer.appendChild(card);
  });
}

function getCategoryColor(title) {
  const colors = {
    'Work': 'hsl(15, 100%, 70%)',
    'Play': 'hsl(195, 74%, 62%)',
    'Study': 'hsl(348, 100%, 68%)',
    'Exercise': 'hsl(145, 58%, 55%)',
    'Social': 'hsl(264, 64%, 52%)',
    'Self Care': 'hsl(43, 84%, 65%)'
  };
  return colors[title] || 'hsl(235, 46%, 30%)';
}

timeframeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    timeframeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const period = btn.dataset.period;
    renderCards(period);
  });
});


renderCards('daily');