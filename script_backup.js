// Initialize the MapLibre map
const map = new maplibregl.Map({
  container: 'map', // container id
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // Map style URL
  center: [-74.006, 40.7128], // Initial map center [lng, lat] - New York City
  zoom: 10 // Initial zoom level
});

map.addControl(new maplibregl.NavigationControl());

function getColor(item) {
  if (item == 'N'){
      return 'gray'
  }
  else {
      if (item <= 3 || item == 'P'){
          return 'red';
      }
      else if (item <= 6 || item == 'F') {
          return 'orange'
      }
      else if (item <= 9 || item == 'G') {
          return 'green'
      }
      else {
          return 'gray'
      }    
  }
}

function getCode(item){
if (item == 'N'){
  return 'nan'
}
else {
    if (item == 'P'){
        return 'Poor';
    }
    else if (item == 'F') {
        return 'Fair'
    }
    else if (item == 'G') {
        return 'Good'
    }
    else {
        return 'None'
    }    
}
}

// Cache for geocode results
const geocodeCache = {};

// Geocode function using Nominatim API
const geocode = async (query) => {
  if (geocodeCache[query]) {
      return geocodeCache[query];
  }

  // Define the bounding box (example: New York City area)
  const minLon = -74.259;
  const minLat = 40.477;
  const maxLon = -73.700;
  const maxLat = 40.917;

  try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${minLon},${minLat},${maxLon},${maxLat}&bounded=1`);
      const data = await response.json();
      console.log('API response:', data); // Log the response for debugging
      geocodeCache[query] = data || []; // Cache the result
      return data || []; // Ensure it returns an array even if data is null
  } catch (error) {
      console.error('Error fetching geocode data:', error);
      return [];
  }
};

// Debounce function to limit the rate of API calls
const debounce = (func, delay) => {
  let debounceTimer;
  return function(...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
};

// Search input event listener
document.getElementById('search-input').addEventListener('keypress', async (e) => {
if (e.key === 'Enter') {
  const query = e.target.value;
  const location = await geocode(query);
  
  if (location) {
    map.flyTo({
      center: location,
      zoom: 12
    });
  } else {
    alert('Location not found');
  }
}
});

// Show suggestions in the dropdown
const showSuggestions = (suggestions) => {
  const suggestionsContainer = document.getElementById('suggestions');
  suggestionsContainer.innerHTML = ''; // Clear previous suggestions

  console.log(suggestions);

  if (suggestions && suggestions.length > 0) {
    suggestionsContainer.style.display = 'block';

    const limitedSuggestions = suggestions.slice(0, 4);

    limitedSuggestions.forEach((item) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = item.display_name;
      suggestionItem.onclick = () => {
        map.flyTo({
          center: [parseFloat(item.lon), parseFloat(item.lat)],
          zoom: 12
        });
        suggestionsContainer.style.display = 'none';
        document.getElementById('search-input').value = item.display_name;
      };
      suggestionsContainer.appendChild(suggestionItem);
    });
  } else {
    suggestionsContainer.style.display = 'none';
  }
};

// Debounced search input event listener
document.getElementById('search-input').addEventListener('input', debounce(async (e) => {
  const query = e.target.value;
  if (query.length > 2) { // Only search if query is longer than 2 characters
    const suggestions = await geocode(query);
    showSuggestions(suggestions);
  } else {
    document.getElementById('suggestions').style.display = 'none';
  }
}, 300)); // Adjust the debounce delay as needed

// Hide suggestions if user clicks outside
document.addEventListener('click', (e) => {
  const suggestionsContainer = document.getElementById('suggestions');
  if (!document.getElementById('search-container').contains(e.target)) {
    suggestionsContainer.style.display = 'none';
  }
});

map.on('load', () => {
  // Add the GeoJSON source
  map.addSource('points', {
      'type': 'geojson',
      'data': 'output.geojson' // Path to your GeoJSON file
  });

  // Add a layer to display the points
  map.addLayer({
      'id': 'points-layer',
      'type': 'circle',
      'source': 'points',
      'paint': {
      'circle-radius': 6,
      'circle-color': [
          'match',
          ['get', 'BRIDGE_CONDITION'],
          'P',
          'red',
          'F',
          'orange',
          'G',
          'green',
          /* other */ '#ccc'
      ]
      }
  });

  // Add a popup to show the name when a point is clicked
  map.on('click', 'points-layer', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();

      const data = {
          'name':e.features[0].properties.FACILITY_CARRIED_007,
          'deck':e.features[0].properties.DECK_COND_058,
          'superstructure':e.features[0].properties.SUPERSTRUCTURE_COND_059,
          'substructure':e.features[0].properties.SUBSTRUCTURE_COND_060,
          'culvert':e.features[0].properties.CULVERT_COND_062,
          'scour':e.features[0].properties.SCOUR_CRITICAL_113,
          'traffic':e.features[0].properties.ADT_029,
          'trucks':e.features[0].properties.PERCENT_ADT_TRUCK_109,
          'overall':e.features[0].properties.BRIDGE_CONDITION,
      }

      console.log(data.culvert == 'N');

      const name = e.features[0].properties.FACILITY_CARRIED_007;

      // Ensure popup appears at the correct place on the map
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      new maplibregl.Popup()
        .setLngLat(coordinates)
        .setHTML(` 
  <div class="topBar ${getColor(data.overall)}">${getCode(data.overall)}</div>
  <h4 class="bridge_id">${data.name}</h4>
  <h5 class="year">Built in 1997</h5>
  <div class="data-container">
      <div class="bridge-data">
          <p class="bridge-datum">Deck <span class="icon ${getColor(data.deck)}">${data.deck}</span></p>
          <p class="bridge-datum">Superstructure <span class="icon ${getColor(data.superstructure)}">${data.superstructure}</span></p>
          <p class="bridge-datum">Substructure <span class="icon ${getColor(data.substructure)}">${data.substructure}</span></p>
          <p class="bridge-datum">Culvert <span class="icon ${getColor(data.culvert)}">${data.culvert}</span></p>
          <p class="bridge-datum">Scour <span class="icon ${getColor(data.scour)}">${data.scour}</span></p>
      </div>
      <div class="barrier"></div>
      <div class="bridge-data">
          <div class="data-item-group">
              <h6>Daily Traffic</h6>
              <h3>${Intl.NumberFormat('en-US').format(data.traffic.toFixed(2))}</h3>
          </div>
          <div class="data-item-group">
              <h6>Share of trucks</h6>
              <h3>${data.trucks}%</h3>
          </div>
          <div class="data-item-group">
              <h6>Cost to fix</h6>
              <h3>$762M</h3>
          </div>
      </div>
  </div>`)
        .addTo(map);
  });

  // Change the cursor to a pointer when hovering over a point
  map.on('mouseenter', 'points-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
  });

  // Reset the cursor when leaving the point
  map.on('mouseleave', 'points-layer', () => {
      map.getCanvas().style.cursor = '';
  });
});