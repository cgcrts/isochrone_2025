const swissBounds = [
    [45.6, 5.8],   // SW corner
    [47.9, 10.7]   // NE corner
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
    minZoom: 8,
    maxZoom: 14,
}).fitBounds(swissBounds);

const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
});

const bivariate = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/bivariate/{z}/{x}/{y}.png', {
    tileSize: 256,
})

const bivariateBorder = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/border/{z}/{x}/{y}.png', {
    minZoom: 10,
    tileSize: 256,
})

const bivariateOverlay = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/background/overlay/{z}/{x}/{y}.png', {
    tileSize: 256,
    opacity: 0.2,
})

const area = L.tileLayer('https://rtsinfo-data.s3.amazonaws.com/cgc/assets/geodata/bivariate_isochrones_v2/area/{z}/{x}/{y}.png', {
    tileSize: 256,
})

positron.addTo(map)
bivariateOverlay.addTo(map)
//bivariate.addTo(map)
area.addTo(map)
bivariateBorder.addTo(map)

map.setMaxBounds(swissBounds)

setTimeout(RTSInfoMisc.resize(), 200)