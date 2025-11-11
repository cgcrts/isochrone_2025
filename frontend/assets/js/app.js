const mapElem = document.getElementById("map");
//const HRDF_SERVER_URL = "https://iso.hepiapp.ch/api/";
const HRDF_SERVER_URL = "http://localhost:8100/";

/** Pretty Palettes ! */
const palette1 = [
    "#36AB68", // Nearest.
    "#91CF60", //
    "#D7FF67", //
    "#FFD767", //
    "#FC8D59", //
    "#E2453C", // Furthest.
];
const palette2 = [
    "#00ffef",
    "#00aeeb",
    "#3982d1",
    "#6b62b7",
    "#a24eaa",
    "#cd2f88",
];

const legendContainer = document.getElementById("legendContainer");
const legend = document.getElementById("legend");
const legend2 = document.getElementById("legend-2");
// Form.
const formElem = document.getElementById("form");
const ctrlsPoint2 = document.getElementById("ctrls-point-2");
const selectOriginPointElem1 = document.getElementById("select-origin-point-1");
const selectOriginPointElem2 = document.getElementById("select-origin-point-2");

const locationInputs = document.getElementsByClassName("locationInput");

const departureAtInput = document.getElementById("departure-at");
const timeLimitInput = document.getElementById("time-limit");
const isochroneIntervalInput = document.getElementById("isochrone-interval");

const findOptimalInput = document.getElementById("find-optimal");
const submitButton = document.getElementById("submit-button");

const advancedOptionsSelect = document.getElementById("advancedOptionsSelect");
const advancedOptions = document.getElementById("advancedOptions");
const geoOptionsSelect = document.getElementById("geoOptionsSelect");
const geoOptionsLabels = document.querySelector(".geoOptionsCheckbox").querySelectorAll('label');

/* Second point controls */

// let originPointOffset = [0, 0];
// let originPointOffset2 = [0, 0];
let originPointOffsets = [
    [0, 0],
    [0, 0],
];
let isSelectingOriginPoint = false;
let isSelectingOriginPoint_markerIndex = 0;

let markers = [null, null];
let furthestMarkers = [null, null];
let furthestMarkersLayerGroup = null;

let selectOriginPointElems = [selectOriginPointElem1, selectOriginPointElem2];

//let originPointMarker = null;
let isochronesLayer = null;
// let originPointCoord = null;
// let originPointCoord2 = null;
let originPointCoords = [null, null];
let isFormSubmitted = false;
let abortController = new AbortController();
let isochronesBoundingBoxes = []

let isMapMoving = false;

let onMarkerPlacementEndCallback = null;

const customMarker = L.icon({
    iconUrl: "./assets/images/markerSD.png",
    iconSize: [32, 43],
    iconAnchor: [16, 43],
});

const customMarker2 = L.icon({
    iconUrl: "./assets/images/markerRedSD.png",
    iconSize: [32, 43],
    iconAnchor: [16, 43],
});

const pin = L.icon({
    iconUrl: "./assets/images/pin.svg",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
});

const pin2 = L.icon({
    iconUrl: "./assets/images/pin_red.svg",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
});

/** Callbacks */

let onStartComputeIsochrone = () => {
    findOptimalInput.disabled = true;
    openToaster();
};

let onFinishComputeIsochrone = () => {
    findOptimalInput.disabled = false;
    closeToaster();
};

const ResetToaster = () => {
    let messages = document
        .getElementById("toast-content")
        .querySelectorAll("p");

    messages.forEach((message) => {
        message.classList.add("hidden");
    });
};

// Different openstreetmap tiles
var Stadia_AlidadeSmooth = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}",
    {
        attribution:
            '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        ext: "png",
    },
);

var CartoDB_Positron = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
    },
);

// get window width to see if user is on mobile
const windowWidth = window.innerWidth

const centerLat = 46.87;
let centerLng
let initialZoom

// adapt initial zoom and map center point if on desktop or mobile (width < 450px)
if (windowWidth < 450) {
    initialZoom = 7;
    centerLng = 7.4
} else {
    initialZoom = 8;
    centerLng = 8.13;
}

// center of switzerland coordinates:
const map = L.map("map").setView([centerLat, centerLng], initialZoom);

function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function zoomToIsochrones() {
    // flatten the array of arrays of coordinates to get an array of coordinates that can be passed as a bbox
    const combinedBoundingBoxes = L.latLngBounds(isochronesBoundingBoxes.flat());

    // fitBounds accept an array of [lat, lng] coordinates
    map.fitBounds(combinedBoundingBoxes, { animate: true });

}

// Functions.
const init = () => {
    setMinMaxDepartureAt();
    departureAtInput.value = getCurrentDateTime();
    // departureAtInput.value = departureAtInput.max;
    updateIsochroneIntervalOptions();

    var baseMap = CartoDB_Positron;
    baseMap.addTo(map);
    map.createPane("isochrones0");
    map.getPane("isochrones0").style.opacity = 0.6;
    map.createPane("isochrones1");
    map.getPane("isochrones1").style.opacity = 0.6;

    furthestMarkersLayerGroup = L.layerGroup();

    // resize iframe when embedded on a website
    setTimeout(RTSInfoMisc.resize(), 200)
};

const setMinMaxDepartureAt = async () => {
    try {
        const response = await fetch(HRDF_SERVER_URL + "metadata");
        const metadata = await response.json();

        departureAtInput.min = `${metadata.start_date}T00:00`;
        departureAtInput.max = `${metadata.end_date}T23:59`;
    } catch (err) {
        // alert("Une erreur inconnue s'est produite lors du chargement des métadonnées.");
        return;
    }
};

const displayIsochroneMap = async (idx, clear = true) => {
    if (originPointCoords[idx] === null) {
        alert("Vous devez d'abord choisir un point d'origine.");
        return;
    }

    if (clear) {
        clearPreviousIsochroneMap();
    }
    let isochroneMap;
    const params = new URLSearchParams(getRequestParams(idx));
    try {
        const response = await fetch(
            HRDF_SERVER_URL + "isochrones?" + params.toString(),
            {
                signal: abortController.signal,
            },
        );
        isochroneMap = await response.json();
    } catch (err) {
        if (err.name === "AbortError") {
            return;
        }

        alert("Une erreur inconnue s'est produite. Veuillez réessayer.");
        return;
    }

    if (isochroneMap.isochrones.length === 0) {
        alert(
            "La carte isochrone n'a pas pu être calculée, car aucun arrêt n'est atteignable dans le temps imparti.",
        );
        return;
    }

    isochronesBoundingBoxes.push(isochroneMap.bounding_box)

    displayIsochrones(isochroneMap, idx);
    if (params.get("find_optimal") === "true") {
        setOptimalDepartInLegend(isochroneMap.departure_at, idx);
        document
            .getElementById(`optimal-legend-${idx + 1}`)
            .classList.remove("hidden");
    }

    legendContainer.classList.remove("hidden");

    isochronesLayer.addTo(map);

    // resize iframe when embedded on a website
    setTimeout(RTSInfoMisc.resize(), 200)
};

const clearPreviousIsochroneMap = () => {
    legend.innerHTML = "";
    legend2.innerHTML = "";

    legend2.parentElement.parentElement.classList.add("hidden");

    document
        .querySelectorAll(".optimal-container")
        .forEach((elem) => elem.classList.add("hidden"));
    document
        .querySelectorAll(".legend-optimal-time")
        .forEach((elem) => elem.classList.add("hidden"));
    // Remove the furthest point markers if they're present
    removeFurthestMarker(0);
    removeFurthestMarker(1);
    if (isochronesLayer !== null) {
        isochronesLayer.remove();
    }
    isochronesLayer = L.layerGroup();
};

const getRequestParams = (idx = 0) => {
    const [departureDate, departureTime] = departureAtInput.value
        .replace(" ", "T")
        .split("T");
    const timeLimit = timeLimitInput.value;
    const isochroneInterval = isochroneIntervalInput.value;
    const findOptimal = findOptimalInput.checked;
    const params = {
        origin_point_latitude: originPointCoords[idx][0],
        origin_point_longitude: originPointCoords[idx][1],
        departure_date: departureDate,
        departure_time: departureTime,
        time_limit: timeLimit,
        isochrone_interval: isochroneInterval,
        display_mode: "circles",
        //Find optimal param
        find_optimal: findOptimal,
    };

    return params;
};

const displayIsochrones = async (isochroneMap, index = 0) => {
    let legend_div = index === 0 ? legend : legend2;
    let pane = index === 0 ? "isochrones0" : "isochrones1";
    let palette = index === 0 ? palette1 : palette2;
    // Use the appropriate colors depending on the number of isochrones to be displayed.
    const colors = [
        [0],
        [0, 5],
        [0, 4, 5],
        [0, 3, 4, 5],
        [0, 1, 3, 4, 5],
        [0, 1, 2, 3, 4, 5],
    ][isochroneMap.isochrones.length - 1]
        .map((index) => palette[index])
        .reverse();

    let all_polygons = [];
    // Displays isochrones by layer from largest to smallest.
    for (const [i, isochrone] of isochroneMap.isochrones.reverse().entries()) {
        let iso_polygons = [];
        const color = colors[i];
        for (const polygon of isochrone.polygons) {
            let ext_int_poly = [];
            let latlngs = [];
            for (const point of polygon.exterior) {
                latlngs.push([point.x, point.y]);
            }
            ext_int_poly.push(latlngs);

            for (const interior of polygon.interiors) {
                let int_points = [];
                for (const point of interior) {
                    int_points.push([point.x, point.y]);
                }
                ext_int_poly.push(int_points);
            }
            // Build the polygon
            let poly = L.polygon(ext_int_poly, {
                color: "black",
                weight: 1.0,
                fillColor: color,
                fillOpacity: 1.0,
                pane: pane,
            });
            // Draw the polygon on the layer
            poly.addTo(isochronesLayer);
            // Add it to the polygon list
            iso_polygons.push(poly.toGeoJSON());
        }
        const colorWithOpacity = hexToRgba(color, 0.7)
        // Append the legend entry
        legend_div.appendChild(
            createLegend(colorWithOpacity, isochrone.time_limit, i, index),
        );

        // Add the sublist to the list of all polygons
        all_polygons.push(iso_polygons);
    }

    // show legend of 2nd isochrone if index is 1
    if (index === 1) {
        legend2.parentElement.parentElement.classList.remove("hidden");
    }

    // Merge the polygons
    let aborted = false;
    let len = all_polygons.length;
    // Iterate backwards, compute smallest area first
    for (let i = len - 1; i >= 0; i--) {
        if (aborted) {
            //The work has been aborted, report.
            ResetToaster();
            setAreaInLegend("ABORTED", index, i);
            continue;
        }
        try {
            setAreaInLegend(
                toKm2(isochroneMap.areas[len - i - 1]),
                index,
                i,
            );
        } catch (err) {
            // The worker has been aborted
            console.log(err);
            aborted = true;
            ResetToaster();
            setAreaInLegend("ABORTED", index, i);
        }
        if (i === 0) {
            placePin(
                isochroneMap.max_distances[len - i - 1][0],
                isochroneMap.max_distances[len - i - 1][1],
                index,
            );
        }
    }

    // resize iframe when embedded on a website
    setTimeout(RTSInfoMisc.resize(), 200)
};

const hexToRgba = (hex, opacity) => {
    // Remove "#" if present
    hex = hex.replace(/^#/, '');

    // Parse rgb values
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    // Return rgba string
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Convert a value to kilometers squared.
 * @param {number} val The value to convert
 * @param {number} [fix=2] The number of decimal places
 * @returns The converted value
 */
const toKm2 = (val, fix = 0) => {
    return (val / 1000000).toFixed(fix);
};

/**
 * Convert a value to kilometers.
 * @param {number} val The value to convert
 * @param {number} [fix=2] The number of decimal places
 * @returns The converted value
 */
const toKm = (val, fix = 0) => {
    return (val / 1000).toFixed(fix);
};

/**
 *
 * @param {Array} coord The coordinate to place the pin at, as [lat, lng]
 * @param {number} distance The distance from the origin, in meters
 * @param {number} index The index of the isochrone map (0 for first, 1 for second)
 * @param {number} fix The number of decimal places to show in the marker popup
 */
const placePin = (coord, distance, index = 0, fix = 2) => {
    let lat = coord[0];
    let lng = coord[1];
    let mkr = L.marker([lat, lng], {
        icon: index === 0 ? pin : pin2,
        zIndexOffset: 1600,
        opacity: 1,
    });
    furthestMarkersLayerGroup.addLayer(mkr);
    mkr.bindPopup(
        `<p>Distance depuis l'origine : ${toKm(distance, fix)} km</p>`,
    );
    furthestMarkers[index] = mkr;
};

/**
 *
 * @param {string} value The value to write in the legend
 * @param {number} iso_index The isochrone index (0 for first, 1 for second)
 * @param {number} time_limit_index The time limit index for the current valuess
 */
const setAreaInLegend = (value, iso_index, time_limit_index) => {
    // Search for the element
    let n = `area-value-${iso_index + 1}-${time_limit_index}`;
    let areaLabelElement = document.getElementById(n);
    if (areaLabelElement === null) {
        throw new Error("Area label not found: " + n);
    }
    // Write the value
    areaLabelElement.innerHTML = value;
};

const setMaxDistanceInLegend = (value, iso_index, fix = 2) => {
    // Search for the element
    let n = `legend-max-distance-${iso_index + 1}`;
    let distanceLabelElement = document.getElementById(n);
    if (distanceLabelElement === null) {
        throw new Error("Distance label not found: " + n);
    }
    // Write the value
    distanceLabelElement.innerHTML = value.toFixed(fix);
};

const setOptimalDepartInLegend = (value, iso_idx) => {
    // Search for the element
    let n = `#optimal-legend-${iso_idx + 1}`;
    let optimalDepartLabelElement = document.querySelector(n);
    let timeSpan = optimalDepartLabelElement.querySelector("span.optimal-time");
    // Split the value between date and time
    let [date, time] = value.split("T");
    // Write the values
    timeSpan.innerHTML = time.slice(0, -3);
};

/**
 * Create a legend entry
 * @param {*} color The color to use
 * @param {*} time_limit The time limit value
 * @param {*} time_limit_index The index of the time limit value
 * @param {*} isoIndex The index of the isochrone map (0 for first, 1 for second)
 * @returns
 */
const createLegend = (color, time_limit, time_limit_index, isoIndex = 0) => {
    // Create a new legend entry element
    const legendElement = document.createElement("div");
    legendElement.className = "legend-entry";
    legendElement.id = `legend-entry-${isoIndex + 1}-${time_limit_index}`;
    // Set legend color
    legendElement.style.backgroundColor = color;
    // Create time limit label
    const timeLimitElement = document.createElement("div");
    timeLimitElement.className = "timelimit";
    timeLimitElement.textContent = `${time_limit}`;
    // Create area label
    const areaLabelElement = document.createElement("div");
    areaLabelElement.className = "area";
    areaLabelElement.id = `area-value-${isoIndex + 1}-${time_limit_index}`;
    // Append elements to legend entry
    legendElement.appendChild(timeLimitElement);
    legendElement.appendChild(areaLabelElement);
    return legendElement;
};

/**
 * Updates the isochrone interval options and sets the default to the maximum number of isochrones possible.
 */
const updateIsochroneIntervalOptions = () => {
    isochroneIntervalInput.innerHTML = "";

    for (let i = 0; i < 6; i++) {
        if (timeLimitInput.value % (i + 1) == 0) {
            const value = timeLimitInput.value / (i + 1);
            isochroneIntervalInput.innerHTML += `
                <option value="${value}">${value} minutes, ${i + 1} isochrone${i + 1 > 1 ? "s" : ""}</option>
            `;
            isochroneIntervalInput.value = value;
        }
    }
};

// Helper functions.

/**
 * Build a date string in the format YYYY-MM-DD HH:MM
 * @returns {string} The current date and time in the format YYYY-MM-DD HH:MM
 */
const getCurrentDateTime = () => {
    const now = new Date();
    const pad = (v) => String(v).padStart(2, "0");
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`; // NOTE the 'T'
};

/**
 * Creates a marker on the map.
 * @param {number} lat - The latitude of the marker.
 * @param {number} lng - The longitude of the marker.
 * @param {number} index - Which marker to create. (0 for first isochrone or 1 for second isochrone)
 */
const createMarker = (lat, lng, index = 0) => {
    if (index < 0 || index > 1) {
        //Abort if index
        return;
    }
    let marker = customMarker;
    if (index === 1) {
        marker = customMarker2;
    }
    return L.marker([lat, lng], { icon: marker, zIndexOffset: 1600 }).addTo(
        map,
    );
};

/**
 * Removes a marker from the map.
 * @param {number} index - Which marker to remove. (0 for first isochrone or 1 for second isochrone)
 * @returns
 */
const removeMarker = (index = 0) => {
    if (index < 0 || index > 1) {
        //Abort
        return;
    }

    if (markers[index] !== null) {
        markers[index].remove();
        markers[index] = null;
    }
};

const removeFurthestMarker = (index = 0) => {
    if (index < 0 || index > 1) {
        //Abort
        return;
    }
    if (furthestMarkers[index] !== null) {
        furthestMarkersLayerGroup.removeLayer(furthestMarkers[index]);
        furthestMarkers[index].remove();
        furthestMarkers[index] = null;
    }
};

/**
 * Display the coordinates of the origin point of a specific isochrone.
 * @param {number} index The isochrone index (0 for first, 1 for second)
 * @param {number} lat The latitude of the origin point
 * @param {number} lng The longitude of the origin point
 * @returns
 */
const setCoordValue = (index, lat, lng) => {
    if (originPointCoords[index] === null || lat === null || lng === null) {
        return;
    }
    if (index < 0 || index > 1) {
        //Abort
        return;
    }
};

/**
 * Ends the marker placement mode.
 * @param {number} markerIndex The index of the marker (0 for first, 1 for second)
 */
const EndMarkerPlacement = function (markerIndex) {
    mapElem.classList.remove(`cursor-marker-${markerIndex}`);
    selectOriginPointElems[markerIndex].classList.remove(
        "selecting-origin-point",
    );

    const lat = parseFloat(originPointCoords[markerIndex][0]);
    const lon = parseFloat(originPointCoords[markerIndex][1]);

    // hide button content when in initial state ('Choisir le point d'origine')
    const btnContentInitial = selectOriginPointElems[markerIndex].querySelector('.btn-content-initial');
    btnContentInitial.classList.add('hidden');

    // hide button content when origin point is active ('Cliquer sur la carte')
    const btnContentActive = selectOriginPointElems[markerIndex].querySelector('.btn-content-active');
    btnContentActive.classList.add('hidden');

    // show button content when origin point is selected (selected point coordinates)
    const btnContentSelected = selectOriginPointElems[markerIndex].querySelector('.btn-content-selected')
    btnContentSelected.classList.remove('hidden')
    btnContentSelected.innerHTML =
        `<img src="./assets/images/origin-point.png" width="15"> 
        ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E
        <span class="clearBtn marker">X</span>`;

    // when clear button X is clicked, reset button to initial state and reset selected coordinates
    btnContentSelected.querySelector('.clearBtn').addEventListener('click', (e) => handleClearBtnMarkerClick(e, markerIndex));

    if (markerIndex === 0) {
        ctrlsPoint2.classList.remove('disabled')
        ctrlsPoint2.classList.remove('hidden')
        ctrlsPoint2.querySelector("button").disabled = false;
    }

    setCoordValue(
        markerIndex,
        originPointCoords[markerIndex][0],
        originPointCoords[markerIndex][1],
    );
    isSelectingOriginPoint = false;
    if (onMarkerPlacementEndCallback !== null) {
        onMarkerPlacementEndCallback();
    }

    // resize iframe when embedded on a website
    setTimeout(RTSInfoMisc.resize(), 200)
};

/**
 * Starts the marker placement mode.
 * @param {number} markerIndex The index of the marker (0 for first, 1 for second)
 */
const StartMarkerPlacement = (markerIndex) => {
    mapElem.classList.add(`cursor-marker-${markerIndex}`);
    selectOriginPointElems[markerIndex].classList.add("selecting-origin-point");
    selectOriginPointElems[markerIndex].querySelector('.btn-content-initial').classList.add('hidden')
    selectOriginPointElems[markerIndex].querySelector('.btn-content-active').classList.remove('hidden')
    selectOriginPointElems[markerIndex].querySelector('.btn-content-selected').classList.add('hidden')

    isSelectingOriginPoint_markerIndex = markerIndex;
    isSelectingOriginPoint = true;

    // scroll to map
    setTimeout(() => {
            document.getElementById('map').scrollIntoView({behavior: "smooth"})
        }, 200
    )
};

/**
 * Move the map view to a given coordinate.
 * @param {number} lat The latitude of the new center.
 * @param {number} lng The longitude of the new center.
 * @param {boolean} animate Should the move be animated.
 */
const MoveMapToPoint = (lat, lng, animate = true) => {
    isMapMoving = true;
    map.setView([lat, lng], undefined, { animate: animate });
};

/**
 * Reset the coordinates of a marker.
 * @param {number} markerIndex The index of the marker to reset.
 */
const resetCoordinates = (markerIndex) => {
    originPointCoords[markerIndex] = [null, null];
    setCoordValue(
        markerIndex,
        originPointCoords[markerIndex][0],
        originPointCoords[markerIndex][1],
    );
};

/**
 * Brings an isochrone map to front.
 * @param {number} isoIndex The index of the isochrone map to bring to front (0 for largest, 1 for smallest).
 */
const bringToFront = (isoIndex) => {
    if (isoIndex < 0 || isoIndex > 1) {
        throw new Error("Invalid Index when trying to bring to front.");
    }

    if (isoIndex === 0) {
        map.getPane("isochrones0").style.zIndex = 1000;
        map.getPane("isochrones1").style.zIndex = 700;
    } else {
        map.getPane("isochrones0").style.zIndex = 700;
        map.getPane("isochrones1").style.zIndex = 1000;
    }
    let markerPane = document.getElementsByClassName(
        "leaflet-pane leaflet-marker-pane",
    )[0];
    if (markerPane !== undefined || markerPane !== null) {
        markerPane.style.zIndex = 2000;
    }
};

// About modal

const handleAboutButton = () => {
    document.getElementById('aboutContainer').classList.toggle("hidden");
}

const handleCloseAbout = () => {
    document.getElementById('aboutContainer').classList.add("hidden");
}

// Toaster

const openToaster = () => {
    document.getElementById("toast").classList.remove("hidden");
    startTextCycle();
};

const closeToaster = () => {
    document.getElementById("toast").classList.add("hidden");
    stopTextCycle();
    // scroll to map
    setTimeout(() => {
        document.getElementById('map').scrollIntoView({behavior: "smooth"})
        }, 200
    )

};

let textCycle;

const startTextCycle = () => {
    if (textCycle !== undefined || textCycle !== null) {
        stopTextCycle();
    }

    let messages = document
        .getElementById("toast-content")
        .querySelectorAll("p");

    messages.forEach((message) => {
        message.classList.add("hidden", "noline");
    });

    // Fill the spacer with the longest message
    // document.getElementById("toast-spacer").innerHTML = "".padEnd(len, "&nbsp;");
    let currentToastMessageIndex = 0;
    messages[currentToastMessageIndex].classList.remove("hidden", "noline");
    textCycle = setInterval(() => {
        console.log("Changing to " + currentToastMessageIndex);
        messages[currentToastMessageIndex].classList.add("hidden");
        setTimeout(() => {
            messages[currentToastMessageIndex].classList.add("noline");
            currentToastMessageIndex =
                (currentToastMessageIndex + 1) % messages.length;
            messages[currentToastMessageIndex].classList.remove(
                "hidden",
                "noline",
            );
        }, 500);
    }, 5000);
};

const stopTextCycle = () => {
    clearInterval(textCycle);
};

const changeToasterText = (text, duration = 0) => {
    document.getElementById("toast-content").classList.add("hidden");
    setTimeout(() => {
        document.getElementById("toast-content").innerHTML = text;
        document.getElementById("toast-content").classList.remove("hidden");
    }, duration);
};

// Event listeners.

// Ensures that min and max values cannot be bypassed.
timeLimitInput.addEventListener("change", () => {
    if (timeLimitInput.value < 10) {
        timeLimitInput.value = 10;
    } else if (timeLimitInput.value > 480) {
        timeLimitInput.value = 480;
    }

    updateIsochroneIntervalOptions();
});

// Handles the application's behavior when a point of origin is being selected.
// 1st isochrone
selectOriginPointElem1.addEventListener("click", () => {
    if (selectOriginPointElem1.classList.contains("selecting-origin-point")) {
        EndMarkerPlacement(0);
    } else {
        StartMarkerPlacement(0);
    }
});

// 2nd isochrone
selectOriginPointElem2.addEventListener("click", () => {
    if (selectOriginPointElem2.classList.contains("selecting-origin-point")) {
        EndMarkerPlacement(1);

    } else {
        StartMarkerPlacement(1);
    }
});

/** Triggered when the map is being dragged around
 */
map.on("dragstart", (_) => {
    let index = isSelectingOriginPoint_markerIndex;
    if (markers[index] !== null) {
        originPointOffsets[index][0] =
            markers[index].getLatLng().lat - map.getCenter().lat;
        originPointOffsets[index][1] =
            markers[index].getLatLng().lng - map.getCenter().lng;
    } else {
        originPointOffsets[index][0] = 0;
        originPointOffsets[index][1] = 0;
    }
});

/**
 * Triggered when the map is moved.
 */
/*
map.on("move", (_) => {
    const index = isSelectingOriginPoint_markerIndex;

    //Remove current marker
    removeMarker(index);

    //Compute offset of marker from map center
    originPointCoords[index] = [
        map.getCenter().lat + originPointOffsets[index][0],
        map.getCenter().lng + originPointOffsets[index][1],
    ];

    markers[index] = createMarker(
        originPointCoords[index][0],
        originPointCoords[index][1],
        index,
    );

    mapElem.classList.remove(`cursor-marker-${index}`);
    const btn = selectOriginPointElems[index];
    btn.classList.remove("selecting-origin-point");
    //btn.innerHTML = `<img src="./assets/images/origin-point.png" width="15"> Changer de point d'origine`;
    setCoordValue(
        index,
        originPointCoords[index][0],
        originPointCoords[index][1],
    );
    isSelectingOriginPoint = false;
});

 */

map.on("moveend", (_) => {
    if (isMapMoving) {
        isMapMoving = false;
    }
});

map.on("click", (e) => {
    if (!isSelectingOriginPoint) {
        return;
    }
    let index = isSelectingOriginPoint_markerIndex;
    // A point of origin has been selected.

    //Remove current marker if exist
    removeMarker(index);

    // Retrieve position of click
    if (isSafari()) {
        // Safari browser clicked point on map is inaccurate.
        // It incorrectly uses top left corner of marker icon as the clicked point instead of bottom center of icon, where the cursor is.
        // Clicked point is in lat-lng, but offset is in px.
        // Need to convert clicked lat-lng to px, then apply offset, then convert it back to lat-lng

        // convert to pixel point relative to the map container
        const point = map.latLngToContainerPoint(e.latlng);
        // apply pixel offset (x = half of marker icon width, y = marker icon height)
        const offsetPoint = L.point(point.x + 16, point.y + 43);
        // convert back to latlng
        const offsetLatLng = map.containerPointToLatLng(offsetPoint);

        originPointCoords[index] = [offsetLatLng.lat, offsetLatLng.lng];

    } else {

        originPointCoords[index] = [e.latlng.lat, e.latlng.lng];
    }

    //Create new marker at position
    markers[index] = createMarker(
        originPointCoords[index][0],
        originPointCoords[index][1],
        index,
    );
    //Clean up
    EndMarkerPlacement(index);
});

formElem.addEventListener("submit", async (e) => {
    e.preventDefault();
    onStartComputeIsochrone?.();

    if (isFormSubmitted) {
        abortController.abort();
        abortController = new AbortController();
        return;
    }

    isFormSubmitted = true;
    submitButton.classList.add("btn-cancel-request");
    submitButton.innerHTML = `<img src="./assets/images/target.png" width="20" height="20"> Annuler`;

    try {
        // reset bounding boxes
        isochronesBoundingBoxes = []
        // get isochrone for first origin point
        await displayIsochroneMap(0);
        // only if both origin points are selected get isochrone for second origin point
        if (originPointCoords[0] !== null && originPointCoords[1] !== null) {
            await displayIsochroneMap(1, false);
        }
        // zoom on map to bounds
        zoomToIsochrones()
    } finally {
        isFormSubmitted = false;
        submitButton.classList.remove("btn-cancel-request");
        submitButton.innerHTML = `<img src="./assets/images/target.png" width="20" height="20"> Calculer`;

        onFinishComputeIsochrone?.();
    }
});

legend.addEventListener("click", (_) => {
    bringToFront(0);
});

legend2.addEventListener("click", (_) => {
    bringToFront(1);
});

advancedOptionsSelect.addEventListener('change', (event) => {
    if (event.currentTarget.checked) {
        advancedOptions.style.display = "grid"
    } else {
        advancedOptions.style.display = 'none'
    }
})

geoOptionsSelect.addEventListener('change', (event) => {
    geoOptionsLabels[0].classList.toggle("selected");
    geoOptionsLabels[1].classList.toggle("selected");

    // inputs for 1st isochrone
    locationInputs[0].querySelector('div').classList.toggle("hidden");
    locationInputs[0].querySelector('button').classList.toggle("hidden");

    // inputs for 2nd isochrone
    locationInputs[1].querySelector('div').classList.toggle("hidden");
    locationInputs[1].querySelector('button').classList.toggle("hidden");
})

// Retrieve list of swiss public transport stations with geo coordinates
let stations = [];
fetch("https://rtsinfo-data.s3.amazonaws.com/cgc/assets/datafiles/data_gares_2025.json")
    .then(res => res.json())
    .then(data => {
        stations = data;
        // sort stations alphabetically, considering accent letters as normal letters ('é' and 'e' for example)
        stations.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        console.log("API data:", stations);
    });

const searchInput = [document.getElementById("search-1"), document.getElementById("search-2")];
const resultsBox = [document.getElementById("results-1"), document.getElementById("results-2")];
const clearBtn = [document.getElementById("clearBtn-1"), document.getElementById("clearBtn-2")];

let selectedItem = null;

function handleSearchInput(event, index) {
    // remove accents and lowercase string so that 'geneve' matches with 'Genève'
    const normalizeString = string => string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

    const query = normalizeString(event.target.value.toLowerCase());
    resultsBox[index].innerHTML = "";

    // if user is editing after selection, reset selectedItem
    if (selectedItem) {
        selectedItem = null;
        clearBtn[index].style.display = "none";
    }

    if (!query) return;

    // get the list of stations that include what user has written
    const matches = stations.filter(station =>
        normalizeString(station.name).includes(query)
    ).slice(0, 10); // only show first 10 results

    // create list of suggestions
    matches.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.textContent = item.name;

        div.onclick = () => chooseItem(item, index);
        resultsBox[index].appendChild(div);
    });
}

function chooseItem(item, index) {
    selectedItem = item;

    // put selected name into input field
    searchInput[index].value = item.name;

    // hide results
    resultsBox[index].innerHTML = "";

    // show clear button
    clearBtn[index].style.display = "block";

    // custom action when selected
    removeMarker(index)
    markers[index] = createMarker(item.lat, item.lon, index)
    originPointCoords[index] = [item.lat, item.lon];
    EndMarkerPlacement(index)
}

function handleClearBtnClick(index) {
    clearBtn[index].onclick = () => {
        selectedItem = null;
        searchInput[index].value = "";
        clearBtn[index].style.display = "none";
        resetOriginPointButton(index)
    };
}

function handleClearBtnMarkerClick(event, index) {
    event.stopImmediatePropagation()
    event.stopPropagation()
    resetOriginPointButton(index)
}

function resetOriginPointButton(index) {
    // remove marker and coordinates
    removeMarker(index)
    originPointCoords[index] = null;
    // remove coordinates from marker button and reset to initial state
    const btnContentInitial = selectOriginPointElems[index].querySelector('.btn-content-initial')
    btnContentInitial.classList.remove('hidden')
    const btnContentSelected = selectOriginPointElems[index].querySelector('.btn-content-selected')
    btnContentSelected.classList.add('hidden')
}

searchInput[0].addEventListener("input", (e) => {handleSearchInput(e, 0)});
searchInput[1].addEventListener("input",(e) => {handleSearchInput(e, 1)});

handleClearBtnClick(0)
handleClearBtnClick(1)

init();
