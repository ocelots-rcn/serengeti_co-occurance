let occurrenceData = {};
let occurrenceSpeciesList1 = null;
let occurrenceSpeciesList2 = null;

// Set up make and helper functions
const occurrenceMap = L.map('OccurrenceMap', {
    center: [-2.5, 34.9],
    zoom: 11
});

let occurrenceLayer = L.layerGroup();
occurrenceLayer.addTo(occurrenceMap);

const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(occurrenceMap);

const toggleLayer = (checkbbox) => {
    if(checkbbox.checked) {
        googleSat.addTo(occurrenceMap);
    }
    else {
        googleSat.remove(occurrenceMap);
    }
}

layerToggle = L.control({ position: "topright" });
layerToggle.onAdd = function(map) {
    const div = L.DomUtil.create("div", "toggleLayers");
    div.style['background-color'] = '#fff';
    div.style.padding = '10px';
    div.innerHTML += `<span style="font-size: 1.2em;font-weight: bold">Layers</span><br/>`;
    div.innerHTML += '<input type="checkbox" checked onchange="toggleLayer(this)" /> Satellite Layer' ;
    return div
}
layerToggle.addTo(occurrenceMap);


let varLegend = null;
let speciesLegend = null;
//const ramp = ['#fafa6e', '#ffd24f', '#ffa942','#ff7e46','#f85252'];
const varRamp = ['#6bdc33', '#e2bb00', '#ff8943','#ff64a3','#fd7dff'];
const speciesRamp =['#F50C16', '#0C58F5'];
const gradient = (value, min, inc) => {
    for(let i = 0; i < varRamp.length; i++) {
        if((inc * (i+1)) + min > value) {
            return varRamp[i];
        }
    }
    return varRamp[varRamp.length - 1];
}

const genSpeciesLegend = (sp1, sp2) => {
    if(speciesLegend !== null) {
        speciesLegend.remove();
    }
    speciesLegend = L.control({ position: "bottomleft" });
    speciesLegend.onAdd = function(map) {
        const div = L.DomUtil.create("div", "speciesLegend");
        div.style['background-color'] = '#fff';
        div.style.padding = '10px';
        div.innerHTML += `<span style="font-size: 1.2em;font-weight: bold">Species</span><br/>`;
        div.innerHTML += `<i style="width: 18px;height: 18px;float: left;margin-right: 8px;background-color: ${speciesRamp[0]}"></i>${sp1}<br />`;
        div.innerHTML += `<i style="width: 18px;height: 18px;float: left;margin-right: 8px;background-color: ${speciesRamp[1]}"></i>${sp2}<br />`;
        return div
    }
    speciesLegend.addTo(occurrenceMap);
}

const genVarLegend = (min, max, inc, variable) => {
    if(varLegend !== null) {
        varLegend.remove();
    }
    varLegend = L.control({ position: "bottomleft" });
    varLegend.onAdd = function(map) {
        const div = L.DomUtil.create("div", "varLegend");
        div.style['background-color'] = '#fff';
        div.style.padding = '10px';
        div.innerHTML += `<span style="font-size: 1.2em;font-weight: bold">${variable}</span><br/>`;
        for(let i = 0; i < varRamp.length; i++) {
            div.innerHTML += `<i style="width: 18px;height: 18px;float: left;margin-right: 8px;background-color: ${varRamp[i]}"></i>${(min + (inc * i)).toFixed(4)} &ndash; ${(min + (inc * (i+1))).toFixed(4)}<br />`;    
        }
        return div
    }
    varLegend.addTo(occurrenceMap);
}

// Grab the data
axios.get('../data/co_occurrence.json').then((response) => {
    occurrenceData = response.data;

    // Populate selection list
    let species1 = document.getElementById('OccurrenceSpecies1');
    let species2 = document.getElementById('OccurrenceSpecies2');
    Object.keys(occurrenceData.species).sort().forEach( (val) => {
        let newOption = new Option(val, val);
        species1.add(newOption,undefined);
        newOption = new Option(val, val);
        species2.add(newOption,undefined);
    });

    occurrenceSpeciesList1 = new SlimSelect({
        select: '#OccurrenceSpecies1'
    });

    occurrenceSpeciesList2 = new SlimSelect({
        select: '#OccurrenceSpecies2'
    });

    // Needs a little delay
    setTimeout(() => {
        occurrenceSpeciesList1.set('baboon');
        occurrenceSpeciesList2.set('elephant');
        species1.addEventListener('change', occurrencePlot);
        species2.addEventListener('change', occurrencePlot);
        occurrencePlot();
    }, 500);
    
});

// Update graph when selections changes
const occurrencePlot = () => {
    let variable = document.querySelector('input[name=occurrenceVariable]:checked').value;
    let start = document.getElementById('OccurrenceStart').value;
    let end = document.getElementById('OccurrenceEnd').value;
    let species1 = occurrenceSpeciesList1.selected();
    let species2 = occurrenceSpeciesList2.selected();

    let camera_sites = {}
    let total = {}
    // Build a local list of camera_sites
    for(let site in occurrenceData.camera_sites) {
        // Special case because there are two values unlike other site variables
        if(variable === 'SeasonalGreenness') {
            occurrenceData.camera_sites[site][variable] = null;
        }
        camera_sites[site] = {};
        camera_sites[site][species1] = 0;
        camera_sites[site][species2] = 0;
        camera_sites[site]['SeasonalGreenness'] = [];

        total[species1] = 0;
        total[species2] = 0;
    }
    
    // Get species specific counts by site
    [species1, species2].forEach( species => {
        for( let site in occurrenceData.species[species]) {
            occurrenceData.species[species][site].forEach( data => {
                if(start <= data.date && data.date <= end) {
                    camera_sites[site][species] += 1;
                    camera_sites[site]['SeasonalGreenness'].push(data.SeasonalGreenness);
                    total[species] += 1;
                }
            });
        }
    });

    // Calculate the SeasonalGreenness if needed
    if(variable === 'SeasonalGreenness') {
        for(let site in camera_sites) {
            if(camera_sites[site][variable].length != 0) {
                let array = camera_sites[site][variable];
                occurrenceData.camera_sites[site][variable] = array.reduce( (a, b) => (a + b), 0) / array.length;
            }
        }
    }
    
    let vals = [];
    // Find the min max value of the variable across cameras
    for(let site in occurrenceData.camera_sites) {
        // special check for SeasonalGreenness
        if(occurrenceData.camera_sites[site][variable] !== null) {
            vals.push(occurrenceData.camera_sites[site][variable])
        }
    }
    // Generate legend and plot shaded camera locations
    let max = Math.max(...vals);
    let min = Math.min(...vals);
    let inc = (max - min) / varRamp.length;
    genVarLegend(min, max, inc, variable);
    genSpeciesLegend(species1, species2);

    let x_delta = null;
    let shim = 0;
    occurrenceLayer.clearLayers();
    for(let id in occurrenceData.camera_sites) {
        let site = occurrenceData.camera_sites[id];
        
        let data = [0, 0];
        data[0] = camera_sites[id][species1];
        data[1] = camera_sites[id][species2];
        total = data[0] + data[1];

        if(data[0] !== 0 || data[1] !== 0) {
            let marker = L.circle([site.latitude, site.longitude], {radius: 800, color: gradient(site[variable], min, inc), weight: 2});
            marker.bindPopup(`Camera Site: ${id}<br/><br />Observtions:<br/>[${species1}] ${camera_sites[id][species1]} (${((data[0]/total) *100).toFixed(2)}%)<br/>[${species2}] ${camera_sites[id][species2]} (${((data[1]/total) *100).toFixed(2)}%)`, {
                closeButton: true
            });
            occurrenceLayer.addLayer(marker);

            // Calulate bound
            let bounds = marker.getBounds();
            if(x_delta === null) {
                shim = (bounds._northEast.lng - bounds._southWest.lng) * 0.05;
                x_delta = (bounds._northEast.lng - bounds._southWest.lng) / 6.0;
            }

            // Keep rect off circle border
            let yS = bounds._southWest.lat + shim; 
            let yN =  bounds._northEast.lat - shim;

            // Calculate height as a percentage of available space
            let height = (yS - yN) * (data[0] / total);
            let rect = L.rectangle([[yS - height, site.longitude + x_delta], [yS, site.longitude]], {color: speciesRamp[0], weight: 2, fillOpacity: 0.7});
            occurrenceLayer.addLayer(rect);

            height = (yS - yN) * (data[1] / total);
            let rect2 = L.rectangle([[yS - height, site.longitude - 0.0001], [yS, site.longitude - x_delta - 0.0001]], {color: speciesRamp[1], weight: 2, fillOpacity: 0.7});
            occurrenceLayer.addLayer(rect2);
        }
    }
}