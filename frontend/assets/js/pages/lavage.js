renderHeader('services.html');
  renderFooter();

  // Try to load dynamic settings for hero image if needed
  async function loadSettings() {
    try {
      const res = await apiFetch('/settings');
      if (res['service_lavage']) {
        document.querySelector('.lavage-hero').style.backgroundImage = `linear-gradient(rgba(2, 7, 20, 0.8), rgba(2, 7, 20, 0.9)), url('${res['service_lavage']}')`;
      }
    } catch(e) {}
  }
  loadSettings();

document.getElementById("btnDirections")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Navigation GPS non disponible pour le moment.");
});

