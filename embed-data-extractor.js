(function() {
  // Create a hidden div to store the data if it doesn't exist
  if (!document.getElementById('units-data')) {
    const dataDiv = document.createElement('div');
    dataDiv.id = 'units-data';
    dataDiv.style.display = 'none';
    document.body.appendChild(dataDiv);
  }

  // Function to extract data from Webflow Collection Lists
  function extractData() {
    // Extract units data
    const units = extractUnitsData();
    
    // Extract buildings data
    const buildings = extractBuildingsData();
    
    // Combine the data
    const combinedData = {
      units: units || [],
      buildings: buildings || [],
      buildingImages: {}
    };
    
    // Add building images to the data
    if (buildings && buildings.length > 0) {
      buildings.forEach(function(building) {
        if (building.imageUrl) {
          combinedData.buildingImages[building.id] = building.imageUrl;
        }
      });
    }
    
    // Store the combined data
    document.getElementById('units-data').textContent = JSON.stringify(combinedData);
    console.log('Extracted data:', combinedData.units.length + ' units, ' + combinedData.buildings.length + ' buildings');
    
    // Make sure to notify the iframe that data is ready
    window.parent.postMessage({ type: 'dataExtracted', success: true }, '*');
    
    return combinedData;
  }

  // Function to extract units data
  function extractUnitsData() {
    // Find the Collection List with our custom attribute
    const unitsList = document.querySelector('[data-units-list="true"]');
    if (!unitsList) {
      console.error('Units collection list not found. Add data-units-list="true" to your Collection List.');
      return [];
    }

    // Get all collection items
    const unitItems = unitsList.querySelectorAll('.w-dyn-item');
    const unitsArray = [];

    unitItems.forEach(function(item) {
      try {
        // Extract data from each field
        const unitData = {
          id: getElementText(item, '[data-field="name"]'),
          buildingId: getElementText(item, '[data-field="building-id"]'),
          buildingName: getElementText(item, '[data-field="building-name"]'),
          bedrooms: parseInt(getElementText(item, '[data-field="bedrooms"]')) || 0,
          bathrooms: parseFloat(getElementText(item, '[data-field="bathrooms"]')) || 0,
          interiorSize: parseInt(getElementText(item, '[data-field="interior-size"]')) || 0,
          exteriorSize: parseInt(getElementText(item, '[data-field="exterior-size"]')) || 0,
          totalSize: parseInt(getElementText(item, '[data-field="total-size"]')) || 0,
          price: parseInt(getElementText(item, '[data-field="price"]').replace(/[^0-9]/g, '')) || 0,
          status: getElementText(item, '[data-field="status"]'),
          contactEmail: getElementText(item, '[data-field="contact-email"]'),
          ccEmail: getElementText(item, '[data-field="cc-email"]'),
          coordinates: {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          }
        };

        // If the status is in uppercase, convert it to proper capitalization
        const rawStatus = getElementText(item, '[data-field="status"]');
        let status = rawStatus;
        if (rawStatus === 'AVAILABLE') status = 'Available';
        if (rawStatus === 'RESERVED') status = 'Reserved';
        if (rawStatus === 'SOLD') status = 'Sold';

        unitData.status = status;

        // Try to get the floorplan URL from a link element
        try {
          const floorplanElement = item.querySelector('[data-field="floorplan"]');
          if (floorplanElement) {
            if (floorplanElement.tagName === 'A') {
              unitData.floorPlan = floorplanElement.href;
            } else {
              // If it's not an anchor tag, look for an anchor inside
              const floorplanLink = floorplanElement.querySelector('a');
              if (floorplanLink) {
                unitData.floorPlan = floorplanLink.href;
              } else {
                // If no anchor, try to get the text content which might be a URL
                unitData.floorPlan = floorplanElement.textContent.trim();
              }
            }
          }
        } catch (e) {
          console.warn('Could not extract floorplan URL for unit ' + unitData.id, e);
          unitData.floorPlan = '';
        }

        // SIMPLIFIED IMAGE EXTRACTION
        unitData.images = [];

        // Extract images with data-field="image"
        try {
          const directImages = item.querySelectorAll('img[data-field="image"], [data-field="image"] img');
          
          if (directImages && directImages.length > 0) {
            directImages.forEach(function(img) {
              if (img.src && !img.src.includes('placeholder') && !unitData.images.includes(img.src)) {
                unitData.images.push(img.src);
              }
            });
          }
        } catch (err) {
          console.warn('Error extracting direct images for unit ' + unitData.id + ':', err);
        }

        // Try to find images in jQuery-loaded containers
        try {
          // Try to find based on unit ID or slug
          let jqueryContainer = document.querySelector('#unify-' + unitData.id);
          if (!jqueryContainer) {
            const unitSlug = getElementText(item, '[data-field="slug"]');
            if (unitSlug) {
              jqueryContainer = document.querySelector('#unify-' + unitSlug);
            }
          }
          
          if (jqueryContainer) {
            const jqueryImages = jqueryContainer.querySelectorAll('img');
            if (jqueryImages && jqueryImages.length > 0) {
              jqueryImages.forEach(function(img) {
                if (img.src && !img.src.includes('placeholder') && !unitData.images.includes(img.src)) {
                  unitData.images.push(img.src);
                }
              });
            }
          }
        } catch (jqueryErr) {
          console.warn('Error with jQuery images for unit ' + unitData.id + ':', jqueryErr);
        }

        // Parse polygon points (stored as JSON string)
        try {
          const polygonPointsText = getElementText(item, '[data-field="polygon-points"]');
          if (polygonPointsText) {
            unitData.polygonPoints = JSON.parse(polygonPointsText);
          } else {
            unitData.polygonPoints = [];
          }
        } catch (e) {
          console.warn('Could not parse polygon points for unit ' + unitData.id, e);
          unitData.polygonPoints = [];
        }

        unitsArray.push(unitData);
      } catch (e) {
        console.error('Error processing unit item:', e);
      }
    });

    return unitsArray;
  }

  // Function to extract buildings data
  function extractBuildingsData() {
    // Find the Collection List with our custom attribute
    const buildingsList = document.querySelector('[data-buildings-list="true"]');
    if (!buildingsList) {
      console.warn('Buildings collection list not found. Add data-buildings-list="true" to your Buildings Collection List.');
      return [];
    }

    // Get all collection items
    const buildingItems = buildingsList.querySelectorAll('.w-dyn-item');
    const buildingsArray = [];

    buildingItems.forEach(function(item) {
      try {
        // Extract data from each field
        const buildingName = getElementText(item, '[data-field="name"]');
        
        // Format building ID based on name if not explicitly provided
        let buildingId = getElementText(item, '[data-field="building-id"]');
        if (!buildingId) {
          // Create a formatted ID from the name
          buildingId = 'building-' + buildingName.toUpperCase().replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, '-');
        }
        
        const buildingData = {
          id: buildingId,
          name: buildingName,
          description: getElementText(item, '[data-field="description"]') || "",
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Get the image URL if available - this is the key part for Webflow CMS images
        const imageElement = item.querySelector('[data-field="image"]');
        if (imageElement) {
          // First, check if the element itself is an img
          if (imageElement.tagName === 'IMG') {
            buildingData.imageUrl = imageElement.src;
          } else {
            // If not, look for an img inside the element
            const img = imageElement.querySelector('img');
            if (img) {
              buildingData.imageUrl = img.src;
            } else {
              // If still no img, look for a div with background-image style
              const bgImageEl = imageElement.querySelector('[style*="background-image"]');
              if (bgImageEl) {
                const style = bgImageEl.getAttribute('style');
                const match = style.match(/background-image:\\s*url\\(['"]?([^'"')]+)['"]?\\)/i);
                if (match && match[1]) {
                  buildingData.imageUrl = match[1];
                }
              }
            }
          }
        }

        // If we found an image URL, log it
        if (buildingData.imageUrl) {
          console.log('Found image for building ' + buildingData.id + ':', buildingData.imageUrl);
        }

        buildingsArray.push(buildingData);
      } catch (e) {
        console.error('Error processing building item:', e);
      }
    });

    console.log('Extracted ' + buildingsArray.length + ' buildings from Webflow CMS');
    return buildingsArray;
  }

  // Helper function to safely get text content from an element
  function getElementText(parent, selector) {
    const element = parent.querySelector(selector);
    return element ? element.textContent.trim() : '';
  }

  // FINSWEET INTEGRATION - Check if Finsweet is loaded and running
  function isFinSweetLoaded() {
    return typeof window.fsAttributes !== 'undefined';
  }

  // Wait for Finsweet to load and then run our extraction
  function waitForFinsweet() {
    console.log('Waiting for Finsweet CMS to load all items...');
    
    if (isFinSweetLoaded()) {
      // Wait for the cms.load event from Finsweet
      window.fsAttributes = window.fsAttributes || [];
      window.fsAttributes.push([
        'cmsload',
        (listInstances) => {
          console.log('Finsweet CMS has loaded all items.', listInstances.length + ' lists detected');
          
          // Give a small delay to ensure DOM is fully updated
          setTimeout(() => {
            // Now trigger jQuery loads for all newly added units
            triggerJQueryLoads();
            
            // Wait to ensure jQuery loads have time to complete
            setTimeout(() => {
              extractData();
            }, 2000);
          }, 1000);
        },
      ]);
    } else {
      // If Finsweet isn't detected yet, check again after a short delay
      console.log('Finsweet not detected yet, checking again in 500ms...');
      setTimeout(waitForFinsweet, 500);
    }
  }
  
  // Function to directly trigger jQuery loads for all units
  function triggerJQueryLoads() {
    // Find all the unit items
    const allUnits = document.querySelectorAll('[data-units-list="true"] .w-dyn-item');
    console.log('Triggering jQuery loads for ' + allUnits.length + ' units');
    
    // Process each unit
    let processedCount = 0;
    
    allUnits.forEach(function(item) {
      const unitId = getElementText(item, '[data-field="name"]');
      const unitSlug = getElementText(item, '[data-field="slug"]');
      
      if (unitSlug) {
        // Look for the container that should receive jQuery content
        const container = document.getElementById('unify-' + unitSlug);
        
        if (container && typeof jQuery !== 'undefined') {
          // Check if content is already loaded
          if (container.children.length === 0) {
            // Content not yet loaded, trigger jQuery load
            jQuery('#unify-' + unitSlug).load('/units/' + encodeURIComponent(unitSlug) + ' .unit-media-gallery', function() {
              processedCount++;
              console.log('Loaded jQuery content for unit ' + unitId + ' (' + processedCount + '/' + allUnits.length + ')');
            });
          } else {
            // Content already loaded
            processedCount++;
          }
        }
      }
    });
  }

  // Start the process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForFinsweet);
  } else {
    waitForFinsweet();
  }
})();
