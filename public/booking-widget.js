/**
 * Showcase Booking Widget
 * Embed meeting scheduling on any website
 *
 * Usage:
 *
 * Popup:
 *   <script src="https://crm.showcasebuilders.com/booking-widget.js"></script>
 *   <button onclick="ShowcaseBooking.open('your-slug')">Book a Meeting</button>
 *
 * Inline:
 *   <div id="booking"></div>
 *   <script src="https://crm.showcasebuilders.com/booking-widget.js"></script>
 *   <script>ShowcaseBooking.render('your-slug', '#booking');</script>
 */
(function() {
  'use strict';

  window.ShowcaseBooking = {
    domain: 'crm.showcasebuilders.com',
    _activeOverlay: null,

    /**
     * Initialize with custom options
     * @param {Object} options - Configuration options
     * @param {string} options.domain - Override the default domain
     */
    init: function(options) {
      if (options && options.domain) {
        this.domain = options.domain;
      }
    },

    /**
     * Get the full booking URL for a meeting type
     * @param {string} slug - The meeting type slug
     * @returns {string} Full booking URL
     */
    getLink: function(slug) {
      return 'https://' + this.domain + '/book/' + slug;
    },

    /**
     * Get a cookie value by name
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null
     */
    _getCookie: function(name) {
      var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    },

    /**
     * Extract fbclid from _fbc cookie
     * Cookie format: fb.1.{timestamp}.{fbclid}
     * @returns {string|null} fbclid or null
     */
    _extractFbclidFromCookie: function() {
      var fbc = this._getCookie('_fbc');
      if (fbc) {
        var parts = fbc.split('.');
        if (parts.length >= 4) {
          return parts.slice(3).join('.');
        }
      }
      return null;
    },

    /**
     * Build URL with embed params and UTM/Facebook passthrough
     * @param {string} slug - The meeting type slug
     * @returns {string} URL with query params
     */
    _buildEmbedUrl: function(slug) {
      var self = this;
      var url = this.getLink(slug) + '?embed=true';

      // Pass through UTM params and fbclid from parent page
      try {
        var params = new URLSearchParams(window.location.search);
        var trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'];
        trackingParams.forEach(function(param) {
          var value = params.get(param);
          if (value) {
            url += '&' + param + '=' + encodeURIComponent(value);
          }
        });

        // If fbclid not in URL, try to extract from _fbc cookie
        if (!params.get('fbclid')) {
          var fbclidFromCookie = self._extractFbclidFromCookie();
          if (fbclidFromCookie) {
            url += '&fbclid=' + encodeURIComponent(fbclidFromCookie);
          }
        }

        // Pass _fbp cookie value if it exists
        var fbp = self._getCookie('_fbp');
        if (fbp) {
          url += '&fbp=' + encodeURIComponent(fbp);
        }
      } catch (e) {
        // URLSearchParams not supported, skip tracking passthrough
      }

      return url;
    },

    /**
     * Open booking in a popup modal
     * @param {string} slug - The meeting type slug
     * @param {Object} options - Configuration options
     * @param {number} options.width - Modal width (default: 700)
     * @param {number} options.height - Modal height (default: 700)
     * @param {Function} options.onBooked - Callback when booking is complete
     * @param {Function} options.onClose - Callback when modal is closed
     */
    open: function(slug, options) {
      var self = this;
      options = options || {};
      var width = options.width || 700;
      var height = options.height || 700;

      // Close any existing overlay
      if (this._activeOverlay) {
        this.close();
      }

      // Create overlay
      var overlay = document.createElement('div');
      overlay.id = 'showcase-booking-overlay';
      overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'right: 0',
        'bottom: 0',
        'background: rgba(0, 0, 0, 0.5)',
        'z-index: 99999',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 20px',
        'box-sizing: border-box'
      ].join(';');

      // Create modal container
      var modal = document.createElement('div');
      modal.style.cssText = [
        'background: white',
        'border-radius: 12px',
        'overflow: hidden',
        'max-width: ' + width + 'px',
        'width: 100%',
        'max-height: 90vh',
        'position: relative',
        'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      ].join(';');

      // Close button
      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.style.cssText = [
        'position: absolute',
        'top: 10px',
        'right: 15px',
        'background: none',
        'border: none',
        'font-size: 28px',
        'cursor: pointer',
        'z-index: 1',
        'color: #666',
        'line-height: 1',
        'padding: 5px',
        'transition: color 0.2s'
      ].join(';');
      closeBtn.onmouseover = function() { this.style.color = '#333'; };
      closeBtn.onmouseout = function() { this.style.color = '#666'; };
      closeBtn.onclick = function() {
        self.close();
        if (options.onClose) options.onClose();
      };

      // Create iframe
      var iframe = document.createElement('iframe');
      iframe.src = this._buildEmbedUrl(slug);
      iframe.style.cssText = [
        'width: 100%',
        'height: ' + height + 'px',
        'border: none',
        'display: block'
      ].join(';');
      iframe.setAttribute('title', 'Book a meeting');
      iframe.setAttribute('loading', 'lazy');

      // Message handler
      var messageHandler = function(event) {
        if (!event.data || typeof event.data !== 'object') return;

        switch (event.data.type) {
          case 'showcase-booking-ready':
          case 'showcase-booking-resize':
            var newHeight = Math.min(event.data.height + 20, window.innerHeight * 0.85);
            iframe.style.height = newHeight + 'px';
            break;
          case 'showcase-booking-complete':
            if (options.onBooked) {
              options.onBooked(event.data.meeting);
            }
            break;
        }
      };
      window.addEventListener('message', messageHandler);

      // Store cleanup function
      overlay._cleanup = function() {
        window.removeEventListener('message', messageHandler);
      };

      // Assemble modal
      modal.appendChild(closeBtn);
      modal.appendChild(iframe);
      overlay.appendChild(modal);

      // Close on overlay click (not modal)
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          self.close();
          if (options.onClose) options.onClose();
        }
      };

      // Close on escape key
      var escapeHandler = function(e) {
        if (e.key === 'Escape') {
          self.close();
          if (options.onClose) options.onClose();
        }
      };
      document.addEventListener('keydown', escapeHandler);
      overlay._escapeHandler = escapeHandler;

      // Add to page
      document.body.appendChild(overlay);
      this._activeOverlay = overlay;

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    },

    /**
     * Close the popup modal
     */
    close: function() {
      if (this._activeOverlay) {
        if (this._activeOverlay._cleanup) {
          this._activeOverlay._cleanup();
        }
        if (this._activeOverlay._escapeHandler) {
          document.removeEventListener('keydown', this._activeOverlay._escapeHandler);
        }
        document.body.removeChild(this._activeOverlay);
        this._activeOverlay = null;
        document.body.style.overflow = '';
      }
    },

    /**
     * Render booking inline in a container
     * @param {string} slug - The meeting type slug
     * @param {string} containerSelector - CSS selector for container element
     * @param {Object} options - Configuration options
     * @param {number} options.minHeight - Minimum iframe height (default: 600)
     * @param {Function} options.onBooked - Callback when booking is complete
     * @param {Function} options.onReady - Callback when widget is ready
     */
    render: function(slug, containerSelector, options) {
      options = options || {};
      var container = document.querySelector(containerSelector);

      if (!container) {
        console.error('ShowcaseBooking: Container not found:', containerSelector);
        return null;
      }

      var minHeight = options.minHeight || 400;

      // Create iframe
      var iframe = document.createElement('iframe');
      iframe.src = this._buildEmbedUrl(slug);
      iframe.style.cssText = [
        'width: 100%',
        'min-height: ' + minHeight + 'px',
        'border: none',
        'display: block',
        'transition: height 0.2s ease-out'
      ].join(';');
      iframe.setAttribute('title', 'Book a meeting');
      iframe.setAttribute('loading', 'lazy');

      // Message handler
      var messageHandler = function(event) {
        if (!event.data || typeof event.data !== 'object') return;

        switch (event.data.type) {
          case 'showcase-booking-ready':
            // Set both height and min-height so iframe can shrink to fit content
            iframe.style.height = event.data.height + 'px';
            iframe.style.minHeight = event.data.height + 'px';
            if (options.onReady) options.onReady();
            break;
          case 'showcase-booking-resize':
            iframe.style.height = event.data.height + 'px';
            iframe.style.minHeight = event.data.height + 'px';
            break;
          case 'showcase-booking-complete':
            if (options.onBooked) {
              options.onBooked(event.data.meeting);
            }
            break;
        }
      };
      window.addEventListener('message', messageHandler);

      // Add to container
      container.appendChild(iframe);

      // Return cleanup function
      return {
        destroy: function() {
          window.removeEventListener('message', messageHandler);
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }
      };
    }
  };
})();
