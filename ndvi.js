//Import GEE Feature Collection (Somaliland kml)


var some = ee.List(['Concepcion', 'La Paz'])
var varname = ee.List([concepcion, lapaz])

var locations = ee.Dictionary.fromLists(some, varname);

ui.root.clear()

var map1 = ui.Map();
var map2 = ui.Map();

var linker = ui.Map.Linker([map1, map2]);
// Create the split panels
var splitPanel = ui.SplitPanel({
    firstPanel: map1,
    secondPanel: map2,
    orientation: 'horizontal',
    wipe: true,
    style: { stretch: 'both' }
});


var datePanelStyle = {
    fontWeight: 'bold',
    fontSize: '15px'
};

var before_text = ui.Label({
    value: '~20 days before',
    style: datePanelStyle
});

var previousPanel = ui.Panel({ style: { position: 'bottom-left' } })
    .add(before_text);


var latest_text = ui.Label({
    value: 'latest available',
    style: datePanelStyle
});

var latestPanel = ui.Panel({ style: { position: 'bottom-right' } })
    .add(latest_text);

var sideBarPanel = ui.Panel({ style: { position: 'middle-left', width: '300px' } })
    .add(ui.Label({
        value: 'NDVI Before & After',
        style: {
            fontWeight: 'bold',
            fontSize: '20px'
        }
    }))
    .add(ui.Label({
        value: 'Raw NDVI values taken by Sentinel-2 Satellite. Latest available (right panel) compared to 20 days prior to the latest(left panel).',
        style: {
            fontSize: '14px'
        }
    }))
    .add(ui.Label({
        value: 'Select a location:',
        style: {
            fontSize: '14px'
        }
    }));



ui.root.add(sideBarPanel);
ui.root.add(splitPanel);


// Create palettes for display of NDVI
var ndvi_pal = ['white', 'yellow', '#A9F36A', '#1A4520'];
var vis = {min: 0, max: 1, palette: ndvi_pal};


function dates(imgcol) {
    var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
    var printed = ee.Date(range.get('max')).format('MMMM dd, YYYY');
    return printed;
}



function computeNDVI (area) {
    var geometry;
    map1.clear();
    map2.clear();

    if (area == 'Concepcion') {
        geometry = concepcion;
    } else {
        geometry = lapaz;
    }

    map1.centerObject(geometry);
    
    geometry = ee.FeatureCollection(geometry);

    var newDate = new Date();
    var today = ee.Date(newDate);
    var previous = today.advance(-10, 'day');

    var before30days = today.advance(-20, 'day');
    var before40days = today.advance(-30, 'day');


    // Create image collection of S-2 imagery for the perdiod 2016-2018
    var S2_30 = ee.ImageCollection('COPERNICUS/S2')
        .filterDate(previous, today)
        .filterBounds(geometry);

    var S2 = ee.ImageCollection('COPERNICUS/S2')
        .filterDate(before40days, before30days)
        .filterBounds(geometry);

    // Function to calculate and add an NDVI band
    function addNDVI(image) {
        return image.addBands(image.normalizedDifference(['B8', 'B4']));
    };

    //PRESENT NDVI
    // Add NDVI band to image collection
    S2 = S2.map(addNDVI);

    // Extract NDVI band and create NDVI median composite image
    var NDVI = S2.select(['nd']);
    var NDVImed = NDVI.median();


    // Display NDVI results on map
    map1.addLayer(NDVImed.clip(geometry), { min: 0, max: 0.9, palette: ndvi_pal }, 'NDVI');

    //PAST NDVI
    // Add NDVI band to image collection
    S2_30 = S2_30.map(addNDVI);
    // Extract NDVI band and create NDVI median composite image
    var NDVI_30 = S2_30.select(['nd']);
    var NDVImed_30 = NDVI_30.median(); //I just changed the name of this variable ;)

    // Show the composite image for June 2020
    map2.addLayer(NDVImed_30.clip(geometry), { min: 0, max: 1, palette: ndvi_pal }, 'NDVI');
    // Show the classification result for November 2019

    dates(S2_30).evaluate(function (val) { latest_text.setValue(val) });
    dates(S2).evaluate(function (val) { before_text.setValue(val) });

    map1.add(previousPanel);
    map2.add(latestPanel);

}



var drop = ui.Select({
    items: some.getInfo(),
    onChange: computeNDVI
})
var subTextVis = {
    'margin': '20px 5px 5px 5px',
    'fontSize': '12px',
    'color': 'grey'
};
var text6 = ui.Label('Disclaimer: This product has been derived automatically without validation data. All geographic information has limitations due to the scale, resolution, date and interpretation of the original source materials. No liability concerning the content or the use thereof is assumed by the producer.', subTextVis)


sideBarPanel.add(drop);



map1.setCenter(122,12,6)
map2.add(latestPanel);
map1.add(previousPanel);



/*
 * Legend setup
 */

// Creates a color bar thumbnail image for use in legend from the given color
// palette.
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '80x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(vis.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(vis.min, {margin: '4px 8px'}),
    ui.Label(
        (vis.max / 2),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(vis.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'NDVI Values (0 to 1)',
  style: {fontWeight: 'bold',padding:'20px 0px 0px 0px'}
});


// Add the legendPanel to the map.
var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);


sideBarPanel.add(legendPanel);
sideBarPanel.add(text6);





