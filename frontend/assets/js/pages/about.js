renderHeader('about.html'); 
  renderFooter();

  // Load dynamic settings for images
  async function loadAboutImages() {
    try {
      const settings = await apiFetch('/settings');
      if (settings.about_expertise) document.getElementById('img-about-expertise').src = settings.about_expertise;
      if (settings.about_ingenierie) document.getElementById('img-about-ingenierie').src = settings.about_ingenierie;
      if (settings.about_distribution) document.getElementById('img-about-distribution').src = settings.about_distribution;
    } catch (error) {
      console.error('Failed to load settings', error);
    }
  }
  loadAboutImages();
