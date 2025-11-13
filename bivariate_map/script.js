const gazaBounds = [
    [31.22, 34.21],   // SW corner
    [31.59, 34.57]   // NE corner
];

function layerURL(layerID){
    const layerFolder = 'https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/gaza_destruction/'
    const urlEnding = '/{z}/{x}/{y}.png'

    return layerFolder + layerID + urlEnding
}


const idBaseMap = 'gaza_base'
const idGazaBuilding = 'gaza_building'
const idGaza231015 = 'gaza_231015'
const idGaza240229 = 'gaza_240229'
const idGaza240906 = 'gaza_240906'
const idGaza250404 = 'gaza_250404'

let map = L.map('map', {
    minZoom: 11,
    maxZoom: 16,
}).setView([31.48079, 34.43184], 11)
    .setMaxBounds(gazaBounds); // Centered on gaza

const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
});

const layerGazaBuilding = L.tileLayer(layerURL(idGazaBuilding), {
    tileSize: 256,
})

const layerGaza231015 = L.tileLayer(layerURL(idGaza231015), {
    tileSize: 256,
})

const layerGaza240229 = L.tileLayer(layerURL(idGaza240229), {
    tileSize: 256,
})

const layerGaza240906 = L.tileLayer(layerURL(idGaza240906), {
    tileSize: 256,
})

const layerGaza250404 = L.tileLayer(layerURL(idGaza250404), {
    tileSize: 256,
})

// Layer collection
const layers = {
    layerGaza231015,
    layerGaza240229,
    layerGaza240906,
    layerGaza250404,
};

positron.addTo(map)
//layerGazaBuilding.addTo(map)
layerGaza250404.addTo(map)

// Handle radio button change
document.querySelectorAll('input[name="dateLayer"]').forEach(radio => {
    radio.addEventListener('change', function() {
        // Remove all layers
        Object.values(layers).forEach(layer => map.removeLayer(layer));

        // Add selected layer
        const selected = this.value;
        layers[selected].addTo(map);

        setTimeout(RTSInfoMisc.resize(), 200)
    });
});

setTimeout(RTSInfoMisc.resize(), 200)