const swissBounds = [
    [45.6, 5.8],   // SW corner
    [47.9, 10.7]   // NE corner
];

// get window width to see if user is on mobile
const windowWidth = window.innerWidth

const initialZoom = 8
const centerLat = 46.87;
let centerLng

// adapt map center point if on desktop or mobile (width < 450px)
if (windowWidth < 450) {
    centerLng = 6.75
} else {
    centerLng = 8.13;
}

let map = L.map('map', {
    minZoom: 8,
    maxZoom: 15,
    attributionControl: false,
}).setView([centerLat, centerLng], initialZoom)

// add leaflet attribution without ukrainian flag
const customAttribution = L.control.attribution().addTo(map);
customAttribution.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');

const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
});

const bivariate = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/isochrones_v3/bivariate/{z}/{x}/{y}.png', {
    tileSize: 256,
})

const backgroundBorder = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/border/{z}/{x}/{y}.png', {
    minZoom: 8,
    tileSize: 256,
    opacity: 0.8,
})

const backgroundRoads = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/roads/{z}/{x}/{y}.png', {
    minZoom: 14,
    tileSize: 256,
    opacity: 1,
})

const backgroundOverlay = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/overlay/{z}/{x}/{y}.png', {
    tileSize: 256,
    opacity: 0.3,
})

const area = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/isochrones_v3/area/{z}/{x}/{y}.png', {
    tileSize: 256,
})

positron.addTo(map)
backgroundOverlay.addTo(map)
backgroundRoads.addTo(map)
//bivariate.addTo(map)
area.addTo(map)
backgroundBorder.addTo(map)

// Load local GeoJSON
fetch('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/commune.json')
    .then(res => res.json())
    .then(data => {
        const layer = L.geoJSON(data, {
            style: {
                fillOpacity: 0,
                weight: 1,
                color: 'black',
            }
        })
        //layer.addTo(map);
    })
    .catch(err => console.error("Failed to load GeoJSON:", err));

map.setMaxBounds(swissBounds)

map.on('zoomend', function () {
    const zoom = map.getZoom();

    if (zoom >= 14) {
        area.setOpacity(0.8);
        bivariate.setOpacity(0.8);
    } else {
        area.setOpacity(1);
        bivariate.setOpacity(1)
    }
});

setTimeout(RTSInfoMisc.resize(), 200)