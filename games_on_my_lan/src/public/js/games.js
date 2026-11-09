document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('gameSearch');
  const cards = Array.from(document.querySelectorAll('.game-card'));
  const noResults = document.getElementById('noResults');
  const resultCount = document.getElementById('resultCount');

  if (!searchInput || !cards.length) return;

  const updateCount = (visible, total) => {
    if (!resultCount) return;
    resultCount.textContent = `${visible} de ${total} juegos`;
  };

  updateCount(cards.length, cards.length);

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const gameName = (card.dataset.name || '').toLowerCase();
      const uploaderName = (card.dataset.uploader || '').toLowerCase();
      const originalAuthor = (card.dataset.originalAuthor || '').toLowerCase();

      const matches =
        gameName.includes(query) || uploaderName.includes(query) || originalAuthor.includes(query);

      card.style.display = matches ? '' : 'none';

      if (matches) visibleCount++;
    });

    updateCount(visibleCount, cards.length);

    if (noResults) {
      noResults.style.display = visibleCount === 0 ? '' : 'none';
    }
  });
});
