<script>
(async function () {
  const API = "http://localhost:5000";

  // 1) Fill sidebar categories (agar sidebar page par hai)
  const sidebar = document.querySelector(".sidebar ul");
  if (sidebar) {
    const categories = await fetch(`${API}/api/categories`).then(r => r.json());
    sidebar.innerHTML = categories.map(c => `
      <li data-cat="${c.id}" style="cursor:pointer">
        <span>${c.name}</span>
        <i aria-hidden="true" class="fas fa-chevron-right"></i>
      </li>
    `).join("");

    // click -> load featured by category
    sidebar.addEventListener("click", async (e) => {
      const li = e.target.closest("li[data-cat]");
      if (!li) return;
      const catId = li.getAttribute("data-cat");
      const items = await fetch(`${API}/api/oils?category=${catId}`).then(r => r.json());
      if (items.length) renderBigLeft(items[0]); // show first as primary
      renderRightGrid(items);
    });
  }

  // 2) Initial featured oils load (for main grid)
  const initial = await fetch(`${API}/api/oils?limit=4`).then(r => r.json());
  if (initial.length) {
    renderBigLeft(initial[0]);                 // big-left
    renderRightGrid(initial.slice(1));         // bottom-right-grid
    renderTopRight(initial[1] || initial[0]);  // top-right card fallback
  }

  // Helpers: find containers by existing classes
  const bigLeft = document.querySelector(".big-left");
  const topRight = document.querySelector(".top-right");
  const bottomRight = document.querySelector(".bottom-right-grid");

  function renderBigLeft(oil) {
    if (!bigLeft) return;
    bigLeft.innerHTML = `
      <img src="${oil.img}" alt="${oil.name}">
      <div class="text-block">
        <h2>${oil.name}</h2>
        <p>${oil.desc}</p>
        <a href="/product/${oil.id}">Shop Now</a>
      </div>
    `;
  }

  function renderTopRight(oil) {
    if (!topRight) return;
    topRight.innerHTML = `
      <img src="${oil.img}" alt="${oil.name}">
      <div class="text-block">
        <h3>${oil.name}</h3>
        <p>${oil.desc}</p>
        <a href="/product/${oil.id}">Shop Now</a>
      </div>
    `;
  }

  function renderRightGrid(list) {
    if (!bottomRight) return;
    bottomRight.innerHTML = list.map(o => `
      <div class="bottom-right-item" data-id="${o.id}" style="cursor:pointer">
        <img src="${o.img}" alt="${o.name}">
        <div class="text-block">
          <h4>${o.name}</h4>
          <p>${o.desc}</p>
          <a href="/product/${o.id}">Shop Now</a>
        </div>
      </div>
    `).join("");

    // Click on any card -> make it the big-left focus
    bottomRight.querySelectorAll(".bottom-right-item").forEach(card => {
      card.addEventListener("click", async () => {
        const id = card.getAttribute("data-id");
        const oil = await fetch(`${API}/api/oils/${id}`).then(r => r.json());
        renderBigLeft(oil);
      });
    });
  }
})();
</script>
