let occuranceData = {};
let occuranceSpeciesList1 = null;
let occuranceSpeciesList2 = null;

// Set up make and helper functions
const occuranceMap = L.map('OccuranceMap', {
    center: [-2.5, 34.9],
    zoom: 11
});

const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(occuranceMap);

let occuranceLayer = L.layerGroup();
occuranceLayer.addTo(occuranceMap);

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

    legend.addTo(occuranceMap);
}

// Grab the data
axios.get('../data/co_occurance.json').then((response) => {
    occuranceData = response.data;

    // Populate selection list
    let species1 = document.getElementById('OccuranceSpecies1');
    let species2 = document.getElementById('OccuranceSpecies2');
    Object.keys(occuranceData.species).sort().forEach( (val) => {
        let newOption = new Option(val, val);
        species1.add(newOption,undefined);
        newOption = new Option(val, val);
        species2.add(newOption,undefined);
    });

    occuranceSpeciesList1 = new SlimSelect({
        select: '#OccuranceSpecies1'
    });

    occuranceSpeciesList2 = new SlimSelect({
        select: '#OccuranceSpecies2'
    });

    // Needs a little delay
    setTimeout(() => {
        occuranceSpeciesList1.set('baboon');
        occuranceSpeciesList2.set('elephant');
        species1.addEventListener('change', occurancePlot);
        species2.addEventListener('change', occurancePlot);
        occurancePlot();
    }, 500);
    
});

// Update graph when selections changes
const occurancePlot = () => {
    let variable = document.querySelector('input[name=occuranceVariable]:checked').value;
    let start = document.getElementById('OccuranceStart').value;
    let end = document.getElementById('OccuranceEnd').value;
    let species1 = occuranceSpeciesList1.selected();
    let species2 = occuranceSpeciesList2.selected();

    let camera_sites = {}
    let total = {}
    // Build a local list of camera_sites
    for(let site in occuranceData.camera_sites) {
        // Special case because there are two values unlike other site variables
        if(variable === 'SeasonalGreenness') {
            occuranceData.camera_sites[site][variable] = null;
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
        for( let site in occuranceData.species[species]) {
            occuranceData.species[species][site].forEach( data => {
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
                occuranceData.camera_sites[site][variable] = array.reduce( (a, b) => (a + b), 0) / array.length;
            }
        }
    }
    
    let vals = [];
    // Find the min max value of the variable across cameras
    for(let site in occuranceData.camera_sites) {
        // special check for SeasonalGreenness
        if(occuranceData.camera_sites[site][variable] !== null) {
            vals.push(occuranceData.camera_sites[site][variable])
        }
    }
    let max = Math.max(...vals);
    let min = Math.min(...vals);
    let inc = (max - min) / ramp.length;
    
    // Generate legend and plot shaded camera locations
    genLegend(min, max, inc, variable);
    occuranceLayer.clearLayers();
    for(let id in occuranceData.camera_sites) {
        let site = occuranceData.camera_sites[id];
        
        let data = [0, 0];
        data[0] = camera_sites[id][species1];
        data[1] = camera_sites[id][species2];
        
        if(data[0] !== 0 || data[1] !== 0) {
            let marker = L.circle([site.longitude, site.latitude], {radius: 800, color: gradient(site[variable], min, inc), weight: 2});
            marker.bindPopup(`Camera Site: ${id}<br/><br />Observtions:<br/>[${species1}] ${camera_sites[id][species1]}<br/>[${species2}] ${camera_sites[id][species2]} `, {
                closeButton: true
            });
            occuranceLayer.addLayer(marker);
        }
    }
}