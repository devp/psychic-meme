document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('Service Worker registered with scope:', registration.scope))
            .catch(error => console.error('Service Worker registration failed:', error));
    }

    const swiperWrapper = document.querySelector('.swiper-wrapper');
    const hintLeft = document.getElementById('hint-left');
    const hintRight = document.getElementById('hint-right');
    const feedUrl = 'feed.xml';
    const parser = new RSSParser();

    const swiper = new Swiper('.swiper', {
        direction: 'vertical',
        loop: false,
        touchRatio: 1,
        threshold: 5,
    });

    let horizontalSwipe = false;

    swiper.on('sliderMove', () => {
        const diffX = swiper.touches.currentX - swiper.touches.startX;
        const diffY = swiper.touches.currentY - swiper.touches.startY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            horizontalSwipe = true;
            if (diffX < 0) {
                hintLeft.classList.add('show');
                hintRight.classList.remove('show');
            } else {
                hintRight.classList.add('show');
                hintLeft.classList.remove('show');
            }
        } else {
            horizontalSwipe = false;
        }
    });

    swiper.on('touchEnd', () => {
        if (horizontalSwipe) {
            const diffX = swiper.touches.currentX - swiper.touches.startX;
            if (Math.abs(diffX) > 50) {
                swiper.slideNext();
            }
        }
        hintLeft.classList.remove('show');
        hintRight.classList.remove('show');
        horizontalSwipe = false;
    });

    const fetchAndDisplayFeed = async () => {
        try {
            // NOTE: When fetching a local file, a CORS error can occur in some browsers
            // if you open index.html directly. A local server is recommended for development.
            // For GitHub Pages deployment, this relative path will work correctly.
            const response = await fetch(feedUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const xmlString = await response.text();
            const feed = await parser.parseString(xmlString);

            feed.items.forEach(item => {
                const slide = document.createElement('div');
                slide.classList.add('swiper-slide');

                let contentHTML = '<div class="content">';
                contentHTML += `<h2>${item.title}</h2>`;
                if (item.content) {
                    contentHTML += `<p>${item.contentSnippet || item.content}</p>`;
                }

                // Check for media in enclosure
                if (item.enclosure && item.enclosure.url) {
                    if (item.enclosure.type.startsWith('image/')) {
                         contentHTML += `<img src="${item.enclosure.url}" class="thumbnail" alt="${item.title}">`;
                    } else if (item.enclosure.type.startsWith('video/')) {
                        // For video, we might show a thumbnail and link out
                        // This part can be customized based on feed structure
                        contentHTML += `<div class="video-thumbnail" data-url="${item.link}">`;
                        contentHTML += `<div class="play-button"></div>`;
                        contentHTML += `</div>`;
                    }
                }

                if (item.link) {
                    contentHTML += `<a href="${item.link}" target="_blank" rel="noopener noreferrer">Read More</a>`;
                }
                contentHTML += '</div>';

                slide.innerHTML = contentHTML;

                // Handle video click
                const videoThumbnail = slide.querySelector('.video-thumbnail');
                if (videoThumbnail) {
                    videoThumbnail.addEventListener('click', () => {
                        window.open(videoThumbnail.dataset.url, '_blank');
                    });
                }

                swiperWrapper.appendChild(slide);
            });

            swiper.update();

        } catch (error) {
            console.error('Error fetching or parsing RSS feed:', error);
            swiperWrapper.innerHTML = `<div class="swiper-slide"><div class="content"><h2>Error</h2><p>Could not load the feed. Please try again later.</p></div></div>`;
        }
    };

    fetchAndDisplayFeed();
});