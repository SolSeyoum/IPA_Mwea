// var map = L.map('map').setView([-0.69306, 37.35908], 12);
var mapOptions = { center: [-0.69306, 37.35908], zoom: 12, maxZoom: 19, minZoom: 9, zoomSnap: 0.97, zoomControl: false, zoomsliderControl: true, scrollWheelZoom: true, };
//map create{"lat": -0.69306, "lon":  37.35908},
var map = L.map('map', mapOptions);
//add zoom
var zoomHome = L.Control.zoomHome({ position: 'topleft' });
zoomHome.addTo(map); map.setZoom(13);

// Base Layers
var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
});

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; OpenStreetMap contributors'
// })//.addTo(map);

var wmsLayer = L.tileLayer.wms('https://services.terrascope.be/wms/v2', {
    layers: 'WORLDCOVER_2020_MAP'
})//.addTo(map);

// # Add aerial background
mapLink = '<a href="http://www.esri.com/">Esri</a>';
wholink = 'i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
var arealImageryLayer = L.tileLayer(
    'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; '+mapLink+', '+wholink,
    maxZoom: 19,
})//.addTo(map);



let geojsonLayer, subGeojsonLayer, availableYears = [];
let lastBounds = null;
let tooltip;
let minL;
let maxL;



let indicator;

if (typeof geojsonData === "undefined" || typeof subGeojsonData === "undefined") {
    console.error("GeoJSON data not loaded! Check data.js files.");
} else {
    extractAvailableYears();
    populateYearSelector();
    updateChoropleth("beneficial_fraction", availableYears[0], "mean");
    getBarChartData('0', "beneficial_fraction", availableYears[0], "mean");

    document.getElementById('variableSelector').addEventListener('change', resetMap);
    document.getElementById('yearSelector').addEventListener('change', resetMap);
    document.getElementById('statSelector').addEventListener('change', resetMap);
    indicator = "beneficial_fraction";
}

function resetMap() {
    let selectedVariable = document.getElementById('variableSelector').value;
    let selectedYear = document.getElementById('yearSelector').value;
    let selectedStat = document.getElementById('statSelector').value;

    document.getElementById("refreshBtn").style.display = "none"; // Hide refresh button
    document.getElementById("chartArea").style.display = "none"; // Hide refresh button
    // map.setView([-0.69306, 37.35908], 13);
    document.getElementById("map").style.height = "100%";
    setTimeout(function () { map.invalidateSize() }, 100);
    map.setView([-0.69306, 37.35908], 13);
    // map.setView([-0.69306, 37.35908], 13);
    updateChoropleth(selectedVariable, selectedYear, selectedStat);
    getBarChartData('0', selectedVariable,  selectedYear, selectedStat);
    indicator = selectedVariable;
}


// Extract available years from the data
function extractAvailableYears() {
    let firstFeature = geojsonData.features[0];
    if (!firstFeature || !firstFeature.properties.beneficial_fraction) {
        console.error("GeoJSON format error: No time-series data found.");
        return;
    }
    availableYears = Object.keys(firstFeature.properties.beneficial_fraction);
}

// Populate year selection dropdown
function populateYearSelector() {
    let yearSelector = document.getElementById('yearSelector');
    yearSelector.innerHTML = "";
    availableYears.forEach(year => {
        let option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    });
}

// Update the map based on the selected parameters
function updateMap() {
    document.getElementById("refreshBtn").style.display = "none"; // Hide refresh button
    let selectedVariable = document.getElementById('variableSelector').value;
    let selectedYear = document.getElementById('yearSelector').value;
    let selectedStat = document.getElementById('statSelector').value;
    // map.setView([-0.69306, 37.35908], 13);
    document.getElementById("map").style.height = "100%";
    setTimeout(function () { map.invalidateSize() }, 100);
    map.setView([-0.69306, 37.35908], 13);
    
    map.removeLayer(subGeojsonLayer);
    map.removeControl(layerscontrol);
    updateChoropleth(selectedVariable, selectedYear, selectedStat);
    
    overlays["IPA layer"] = geojsonLayer;
    layerscontrol = L.control.layers(baseLayers, overlays).addTo(map);
    zoomHome.addTo(map); 
    showHide("chartArea");     
    getBarChartData('0', selectedVariable, selectedYear, selectedStat);
    indicator = selectedVariable;
    let { min, max } = getMinMaxValues(geojsonData, selectedVariable, selectedYear, selectedStat);
    minL= min;
    maxL= max;
    info.update(); // Update legend label
}

// Find min and max values dynamically
function getMinMaxValues(data, variable, year, stat) {
    let values = data.features.map(f => f.properties[variable]?.[year]?.[stat] || 0);
    return {
        min: Math.min(...values),
        max: Math.max(...values)
    };
}

// Dynamically adjust colors based on data range
function getColor(value, min, max) {
    if (value === undefined) return '#ccc'; // Default color if value is missing
    let th = 0.01*value;
    let scale = (value - min) / (max+th - min); // Normalize between 0 and 1

    // return  scale < 0.1 ? '#FDE725' :
    //         scale < 0.2 ? '#B4DE2C' :
    //         scale < 0.3 ? '#6DCD59' :
    //         scale < 0.4 ? '#35B779' :
    //         scale < 0.5 ? '#1F9E89' :
    //         scale < 0.6 ? '#26828E' :
    //         scale < 0.7 ? '#31688E' :
    //         scale < 0.8 ? '#3E4A89' :
    //         scale < 0.9 ? '#482878' :
    //         '#440154'; // Darkest for highest values

    function interpolateColor(color1, color2, factor) {
        let result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
        return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
    }
    
    function generateGradientColors(n) {
        let red = [255, 0, 0];     // Red
        let yellow = [255, 255, 0]; // Yellow
        let green = [0, 255, 0];   // Green
        let colors = [];
    
        for (let i = 0; i < n / 2; i++) {
            colors.push(interpolateColor(red, yellow, i / (n / 2 - 1)));
        }
        for (let i = 0; i < n / 2; i++) {
            colors.push(interpolateColor(yellow, green, i / (n / 2 - 1)));
        }
    
        return colors;
    }
    
    const colorGradient = generateGradientColors(10);
    return  scale < 0.1 ? colorGradient[0] :
            scale < 0.2 ? colorGradient[1] :
            scale < 0.3 ? colorGradient[2] :
            scale < 0.4 ? colorGradient[3] :
            scale < 0.5 ? colorGradient[4] :
            scale < 0.6 ? colorGradient[5] :
            scale < 0.7 ? colorGradient[6] :
            scale < 0.8 ? colorGradient[7] :
            scale < 0.9 ? colorGradient[8] :
            scale < 1.0 ? colorGradient[9] :
            colorGradient[10]; // Darkest for highest values

//     return  scale < 0.1 ? '#FDE725' :
//             scale < 0.2 ? '#9C755F' :
//             scale < 0.3 ? '#FF9DA7' :
//             scale < 0.4 ? '#B07AA1' :
//             scale < 0.5 ? '#EDC948' :
//             scale < 0.6 ? '#59A14F' :
//             scale < 0.7 ? '#E15759' :
//             scale < 0.8 ? '#3E4A89' :
//             scale < 0.9 ? '#F28E2B' :
//             scale < 1.0 ? '#E15759' :
//             '#440154'; // Darkest for highest values
}

// Update the choropleth map
var allProps = [];
var barProps = [];
var barlblName;

var section;
function updateChoropleth(variable, year, stat) {
    if (!geojsonData) return;

    if (geojsonLayer) map.removeLayer(geojsonLayer);
    if (subGeojsonLayer) map.removeLayer(subGeojsonLayer);
    
    let { min, max } = getMinMaxValues(geojsonData, variable, year, stat);

    geojsonLayer = L.geoJSON(geojsonData, {
        style: function (feature) {
            let value = feature.properties[variable]?.[year]?.[stat] || 0;
            return {
                fillColor: getColor(value, min, max),
                weight: 1,
                opacity: 1,
                color: 'black',
                fillOpacity: 0.7
            };
        },
        onEachFeature: function (feature, layer) {
            let value = feature.properties[variable]?.[year]?.[stat] || "No Data";
            layer.bindPopup(`<b>Section:</b> ${feature.properties.section_name}<br>
                             <b>${variable.charAt(0).toUpperCase() + variable.slice(1)} (${year}, ${stat}):</b> <strong>${value}</strong>`);
                             
            layer.on('click', function () {
                section = layer.feature.properties.section_name;

                // lastBounds = map.getBounds();
                document.getElementById("map").style.height = "70%";
                setTimeout(function () { map.invalidateSize() }, 100);
                map.fitBounds(layer.getBounds(), { maxZoom: 14 });
                
                // map.fitBounds(layer.getBounds(), { maxZoom: 14 });
                map.removeLayer(geojsonLayer);
                loadSubPolygons(variable, year, stat, section);
                getChartData('0', variable,   stat);
                showHide("chartArea");
                indicator = selectedVariable;

            });

            // layer.on({
            //     // mouseover: highlightFeature,
            //     // mouseout: resetHighlight,
            //     // preclick: resetStyle,
            //     click: zoomToFeature
            // });

            // Highlight polygon and show tooltip on hover
            layer.on('mouseover', function () {
                layer.setStyle({ weight: 2, color: 'white', fillOpacity: 0.9 });

                tooltip = L.tooltip()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(`<b>Section:</b> <strong>${feature.properties.section_name}</strong> <br>
                                <b>${variable} (${year}, ${stat}):</b> <strong>${value}</strong>`)
                    .addTo(map);
            });

            layer.on('mouseout', function () {
                geojsonLayer.resetStyle(layer);
                map.removeLayer(tooltip);
            });
            
            
        }
    }).addTo(map);
}

// Load subpolygons dynamically
var blockSelected
function loadSubPolygons(variable, year, stat, regionName) {
    document.getElementById("refreshBtn").style.display = "block"; // Show refresh button
    if (!subGeojsonData) {
        console.error("Sub-polygon data not found!");
        return;
    }

    if (subGeojsonLayer) map.removeLayer(subGeojsonLayer);

    let { min, max } = getMinMaxValues(subGeojsonData, variable, year, stat);

    subGeojsonLayer = L.geoJSON(subGeojsonData, {
        style: function (feature) {
            let value = feature.properties[variable]?.[year]?.[stat] || 0;
            return {
                fillColor: getColor(value, min, max),
                weight: 1,
                opacity: 1,
                color: 'blue',
                fillOpacity: 0.7
            };
        },
        onEachFeature: function (feature, layer) {
            let value = feature.properties[variable]?.[year]?.[stat] || "No Data";
            layer.bindPopup(`<b>Block:</b> ${feature.properties.block_name}<br>
                             <b>${variable} (${year}, ${stat}):</b> <strong>${value}</strong>`);

            // Highlight polygon and show tooltip on hover
            layer.on('mouseover', function () {
                layer.setStyle({ weight: 2, color: 'white', fillOpacity: 0.9 });

                tooltip = L.tooltip()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(`<b>Block:</b> <strong>${feature.properties.block_name}</strong> <br>
                                <b>${variable} (${year}, ${stat}):</b> <strong>${value}</strong>`)
                    .addTo(map);
            });

            layer.on('mouseout', function () {
                subGeojsonLayer.resetStyle(layer);
                map.removeLayer(tooltip);
            });

            layer.on('click', function () {
               
                blockSelected = layer.feature.properties.block_name;
                getChartData('1', variable, stat);
                // showHide("chartArea");

            });
            
            getBarChartData('1', variable, year, stat);
            minL= min;
            maxL= max;
            info.update(); // Update legend label
            
        },
        filter: function blockFilter(feature) {
            if (feature.properties.section_name === regionName)
                return true
        }
    }).addTo(map);

    map.removeControl(layerscontrol);
    map.removeControl(zoomHome);
    overlays["IPA layer"] = subGeojsonLayer; // Add new layer to overlays
    layerscontrol = L.control.layers(baseLayers, overlays).addTo(map);
 
}



function updateStats(props, level) {
    var cName;
    if (level == "0")
        cName = props.section_name;
    else if (level == "1")
        cName = props.block_name + ' (' + props.section_name + ')';
    $("#lblName").text(cName);
    // $("#lblPopu").text(numFormatter(props.Population));
}


function getBarChartData(level, variable, year, stat) {
    allProps = [];
    let dataBar;
    if (level == '0') {
        barlblName = 'section_name';
        dataBar= geojsonData.features.map(feature => ({
            lable: feature.properties[barlblName],
            data: feature.properties[variable]?.[year]?.[stat] ?? null
          }));
    }
    else if (level == '1') {
        barlblName = 'block_name';
        let filteredData = subGeojsonData.features.filter(item => item.properties.section_name === section);

        dataBar = filteredData.map(item => ({
                lable: item.properties[barlblName],
                data: item.properties[variable]?.[year]?.[stat] ?? null
              }));

    }
       
    allProps = dataBar
    barProps = allProps.sort((a, b) => parseFloat(b.data) - parseFloat(a.data)).slice(0, 5);
    resetBarCanvas();
    barChartRender();
}


function getChartData(level, variable, stat ) {
    allProps = [];
    let dataLine = [];
    if (level == '0') {
        cName = section;

        let feature = geojsonData.features.find(item => item.properties.section_name === section);
        if (!feature) {
          return []; // Return an empty array if no feature found with that name.
        }

        // Get the data for the specified variable (e.g., "temperature")
        let variableData2 = feature.properties[variable];
            
        // Map the data for each year into the desired format.
        dataLine =  Object.entries(variableData2).map(([year, stats]) => ({
          x:  ""+year,  // Convert the year key to a number (or keep as a string if preferred)
          y: ""+stats[stat],     // Extract the desired statistic (e.g., "avg")
          configurable: true
        }));

    }
    else if (level == '1') {
        cName = blockSelected;
        barlblName = 'block_name';

        let feature = subGeojsonData.features.find(item => 
            item.properties.section_name === section && item.properties.block_name === blockSelected
          );
          
          if (!feature) {
            return []; // Return an empty array if no feature found with that name.
          }
  
          // Get the data for the specified variable (e.g., "temperature")
          let variableData2 = feature.properties[variable];
              
          // Map the data for each year into the desired format.
          dataLine =  Object.entries(variableData2).map(([year, stats]) => ({
            x:  ""+year,  // Convert the year key to a number (or keep as a string if preferred)
            y: ""+stats[stat],     // Extract the desired statistic (e.g., "avg")
            configurable: true
          }));

    }
       
    allProps = dataLine;
    resetCanvas();
    chartData(allProps, cName, variable);
    
}

function showHide(element1) {
    var x = document.getElementById(element1);
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}


function resetCanvas() {
    $('#myChart').remove(); // this is my <canvas> element
    $('#chartArea').append('<canvas id="myChart"><canvas>');
}

function resetBarCanvas() {
    $('#barChart').remove(); // this is my <canvas> element
    $('#barChartArea').append('<canvas id="barChart"><canvas>');
}


// function toggleLayerControl() {
//     if (controlAdded) {
//         map.removeControl(layerControl);
//     } else {
//         layerControl = L.control.layers(baseLayers, overlays).addTo(map);
//     }
//     controlAdded = !controlAdded;
// }


let selVar;
let selYr;
let selSt;

let units = {'beneficial_fraction':'-', 'crop_water_deficit': '-',
    'relative_water_deficit': '-', 'total_seasonal_biomass_production': 'ton',
    'seasonal_yield': 'ton/ha', 'crop_water_productivity': 'kg/m<sup>3</sup>'};
let shortnames = {'beneficial_fraction':'BF', 'crop_water_deficit': 'CWD',
        'relative_water_deficit': 'RWD', 'total_seasonal_biomass_production': 'TSBP',
        'seasonal_yield': 'SY', 'crop_water_productivity': 'CWP'};

var info = L.control({ position: 'bottomleft' });

info.onAdd = function (map) {
    
    this._div = L.DomUtil.create('div', 'info-legend'); // create a div with a class "info"
    this.update();
    return this._div;
};


selVar = "beneficial_fraction"
selYr = availableYears[0];
selSt = "mean";


let { min, max } = getMinMaxValues(geojsonData, "beneficial_fraction", availableYears[0], "mean");
minL= min;
maxL= max;

// method that we will use to update the control based on feature properties passed
info.update = function (props) {

    let min = minL;
    let max = maxL;

    let grades = [min, min + (max-min)*0.1, min + (max-min)*0.2, min + (max-min)*0.3, min + (max-min)*0.4, 
        min + (max-min)*0.5, min + (max-min)*0.6, min + (max-min)*0.7, min + (max-min)*0.8, min + (max-min)*0.9, max];

    // var labels = toTitleCase(indicator.replace(/_/g, " "))+"\n"
    var header = shortnames[indicator] + ' - ['+units[indicator]+']' //+ "\n";
    let labels = `<h3>${header}</h3>`;

    // Generate color scale in legend
    for (let i = 0; i < grades.length - 1; i++) {
        let color = getColor(grades[i], min, max);
        labels = labels + `<i style="background:${color}; width: 14px; height: 14px; display: inline-block;"></i> 
                         ${Math.round(grades[i]*100)/100} <br>`;
    }   

    this._div.innerHTML = labels;
};


// 
// // ✅ Event listener for dropdown selection
// document.getElementById("variableSelector").addEventListener("change", function() {
//     let selectedVariable = this.value;
//     indicator = selectedVariable;
//     info.update(); // Update legend label
// });


document.getElementById('variableSelector').addEventListener('change', update_info);
document.getElementById('yearSelector').addEventListener('change', update_info);
document.getElementById('statSelector').addEventListener('change', update_info);


function update_info() {
    selVar = document.getElementById('variableSelector').value;
    selYr = document.getElementById('yearSelector').value;
    selSt = document.getElementById('statSelector').value;
    let layerData;

    if (map.hasLayer(geojsonLayer)) {
        layerData = geojsonData;
    }
    else{
        layerData = subGeojsonData;
    }
    // value = layerData.features.properties[selVar]?.[selYr]?.[selSt];
    let { min, max } = getMinMaxValues(layerData, selVar, selYr, selSt);
    minL= min;
    maxL= max;
    info.update(); // Update legend label
};

info.addTo(map);



//
// Group overlays
var overlays = {
    "IPA layer": geojsonLayer,
}

// Group base layers
var baseLayers = {
    "Street Map": streetLayer,
    "LandCover Map": wmsLayer,
    "Areal Imagery Map": arealImageryLayer
};

// Add default layers
streetLayer.addTo(map);
var layerscontrol = L.control.layers(baseLayers, overlays).addTo(map);



