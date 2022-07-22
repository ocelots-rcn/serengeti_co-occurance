let occurrenceData = {};
let occurrenceSpeciesList1 = null;
let occurrenceSpeciesList2 = null;

// Set up make and helper functions
const occurrenceMap = L.map('OccurrenceMap', {
    center: [-2.5, 34.9],
    zoom: 11
});

const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(occurrenceMap);

let occurrenceLayer = L.layerGroup();
occurrenceLayer.addTo(occurrenceMap);

let legend = null;
//const ramp = ['#fafa6e', '#ffd24f', '#ffa942','#ff7e46','#f85252'];
const ramp = ['#6bdc33', '#e2bb00', '#ff8943','#ff64a3','#fd7dff'];
const gradient = (value, min, inc) => {

    for(let i = 0; i < ramp.length; i++) {
        if((inc * (i+1)) + min > value) {
            return ramp[i];
        }
    }
    return ramp[ramp.length - 1];
}

const genLegend = (min, max, inc, variable) => {
    if(legend !== null) {
        legend.remove();
    }
    legend = L.control({ position: "bottomleft" });
    legend.onAdd = function(map) {
        var div = L.DomUtil.create("div", "legend");
        div.style['background-color'] = '#fff';
        div.style.padding = '10px';
        div.innerHTML += `<h4>${variable}</h4>`;
        for(let i = 0; i < ramp.length; i++) {
            div.innerHTML += `<i style="width: 18px;height: 18px;float: left;margin-right: 8px;background-color: ${ramp[i]}"></i>${(min + (inc * i)).toFixed(4)} &ndash; ${(min + (inc * (i+1))).toFixed(4)}<br />`;    
        }
        return div
    }

    legend.addTo(occurrenceMap);
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
    let max = Math.max(...vals);
    let min = Math.min(...vals);
    let inc = (max - min) / ramp.length;
    
    // Generate legend and plot shaded camera locations
    genLegend(min, max, inc, variable);
    occurrenceLayer.clearLayers();
    for(let id in occurrenceData.camera_sites) {
        let site = occurrenceData.camera_sites[id];
        
        let data = [0, 0];
        data[0] = camera_sites[id][species1];
        data[1] = camera_sites[id][species2];
        
        if(data[0] !== 0 || data[1] !== 0) {
            let marker = L.circle([site.longitude, site.latitude], {radius: 800, color: gradient(site[variable], min, inc), weight: 2});
            marker.bindPopup(`Camera Site: ${id}<br/><br />Observtions:<br/>[${species1}] ${camera_sites[id][species1]}<br/>[${species2}] ${camera_sites[id][species2]} `, {
                closeButton: true
            });
            occurrenceLayer.addLayer(marker);
        }
    }
}