/**
 * Kempinski Embed Script
 * Include this script in your page to embed the Kempinski application.
 * Usage: <div class="kempinski-embed" data-mode="full" data-building-id="123"></div>
 */
(function() {
  // Configuration - Change this URL to your actual deployed application URL
  const config = {
    appUrl: "https://v0-real-estate-unit-visualizer.vercel.app"
  };
  
  // Store for iframe references and their data
  const iframes = [];
  
  // Initialize the embed
  function initEmbed() {
    console.log("Initializing Kempinski embed...");
    
    // Find all embed containers
    const containers = document.querySelectorAll('.kempinski-embed');
    
    if (containers.length === 0) {
      console.warn('No Kempinski embed containers found. Add a div with class "kempinski-embed".');
      return;
    }
    
    containers.forEach(container => {
      // Get container options
      const mode = container.getAttribute('data-mode') || 'full'; // full, listings, or visualizer
      
      // Create iframe for the embed
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = mode === 'full' ? '1200px' : '800px';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.scrolling = 'no';
      
      // Set the source based on the mode
      let src = config.appUrl;
      if (mode === 'listings') {
        src += '/embed/listings';
      } else if (mode === 'visualizer') {
        src += '/embed/visualizer';
      } else {
        src += '/embed/full';
      }
      
      // Add any additional parameters
      const buildingId = container.getAttribute('data-building-id');
      if (buildingId) {
        src += `?buildingId=${encodeURIComponent(buildingId)}`;
      }
      
      // Create a hidden div for storing extracted data
      if (!document.getElementById('units-data')) {
        const dataDiv = document.createElement('div');
        dataDiv.id = 'units-data';
        dataDiv.style.display = 'none';
        document.body.appendChild(dataDiv);
      }
      
      // Load and inject the data extractor script to get data from Finsweet CMS
      const extractorScript = document.createElement('script');
      extractorScript.src = `${config.appUrl}/api/extractor`;
      extractorScript.async = true;
      document.head.appendChild(extractorScript);
      
      // Flag indicating whether we have received data from the extractor
      let dataExtracted = false;
      
      // Store iframe reference
      iframes.push({
        element: iframe,
        container: container,
        embedData: null,
        dataReady: false
      });
      
      // Set the iframe source
      iframe.src = src;
      
      // Clear the container and add the iframe
      container.innerHTML = '';
      container.appendChild(iframe);
      
      // Add a class to indicate the embed is loaded
      container.classList.add('kempinski-embed-loaded');
    });
  }
  
  // Handle messages from iframes and data extractor
  function setupMessageHandling() {
    window.addEventListener('message', function(event) {
      // Handle messages from our data extractor script
      if (event.data && event.data.type === 'dataExtracted' && event.data.success) {
        console.log('Data extraction complete!');
        
        // Get the extracted data from the hidden div
        const dataElement = document.getElementById('units-data');
        if (dataElement && dataElement.textContent) {
          try {
            // Try to parse the JSON data
            const extractedData = JSON.parse(dataElement.textContent);
            
            // Log what we found
            if (extractedData.units) {
              console.log('Extracted units data:', extractedData.units.length + ' units');
            }
            if (extractedData.buildings) {
              console.log('Extracted buildings data:', extractedData.buildings.length + ' buildings');
            }
            if (extractedData.buildingImages) {
              console.log('Extracted building images:', Object.keys(extractedData.buildingImages).length + ' images');
            }
            
            // Update all iframes with the extracted data
            iframes.forEach(iframe => {
              iframe.embedData = extractedData;
              iframe.dataReady = true;
              
              // If this iframe has already requested data, send it now
              if (iframe.requestedData) {
                console.log('Sending delayed data to iframe');
                iframe.element.contentWindow.postMessage({
                  type: 'webflow-data',
                  data: extractedData
                }, '*');
              }
            });
          } catch (e) {
            console.error('Failed to parse extracted data:', e);
          }
        }
      }
      
      // Handle messages from our iframes
      if (!event.source) return;
      
      // Find the iframe that sent the message
      const iframe = iframes.find(item => item.element.contentWindow === event.source);
      if (!iframe) return;
      
      // Process the message
      if (event.data && event.data.type === 'request-data') {
        console.log('Received data request from iframe');
        
        if (iframe.dataReady && iframe.embedData) {
          console.log('Sending embed data to iframe');
          
          // Send the data to the iframe
          event.source.postMessage({
            type: 'webflow-data',
            data: iframe.embedData
          }, '*');
        } else {
          console.log('Data not ready yet, marking iframe as waiting for data');
          iframe.requestedData = true;
          
          // Send a status message to let the iframe know data is loading
          event.source.postMessage({
            type: 'webflow-data-status',
            status: 'loading'
          }, '*');
        }
      } else if (event.data && event.data.type === 'resize-iframe' && event.data.height) {
        // Resize the iframe
        iframe.element.style.height = event.data.height + 'px';
      }
    });
    
    console.log('Message handler set up for iframe communication');
  }
  
  // Load the embed CSS
  function loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${config.appUrl}/embed.css`;
    document.head.appendChild(link);
  }
  
  // Initialize when the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadStyles();
      initEmbed();
      setupMessageHandling();
    });
  } else {
    loadStyles();
    initEmbed();
    setupMessageHandling();
  }
})();
