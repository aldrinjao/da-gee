
ui.root.clear();

lapaz = lapaz.geometry()
concepcion = concepcion.geometry();

var before_start = '2020-10-01';
var before_end = '2020-11-01';

// Now set the same parameters for AFTER the flood.
var after_start = '2020-11-2';
var after_end = '2020-11-25';

var some = ee.List(['Concepcion', 'La Paz'])
var eventTitle = ee.List(['Typhoon Ulysses (Nov 2020)'])
var varname = ee.List([concepcion, lapaz])

var locations = ee.Dictionary.fromLists(some, varname);

var map = ui.Map();



/********************************************************************************************
                           SET SAR PARAMETERS (can be left default)*/

var polarization = "VV"; /*or 'VV' --> VH mostly is the prefered polarization for flood mapping.
                           However, it always depends on your study area, you can select 'VV' 
                           as well.*/
var pass_direction = "DESCENDING"; /* or 'ASCENDING'when images are being compared use only one 
                           pass direction. Consider changing this parameter, if your image 
                           collection is empty. In some areas more Ascending images exist than 
                           than descending or the other way around.*/
var difference_threshold = 1.25; /*threshodl to be applied on the difference image (after flood
                           - before flood). It has been chosen by trial and error. In case your
                           flood extent result shows many false-positive or negative signals, 
                           consider changing it! */
//var relative_orbit = 79; 
/*if you know the relative orbit for your study area, you can filter
 you image collection by it here, to avoid errors caused by comparing
 different relative orbits.*/


/********************************************************************************************

  ******************************************************************************************/


//GLOBAL PARAMATERS
var flood_area_ha;
var before_collection;
var after_collection;

//---------------------------------- Translating User Inputs ------------------------------//

//------------------------------- DATA SELECTION & PREPROCESSING --------------------------//
// Print selected tiles to the console

// Extract date from meta data
function dates(imgcol) {
    var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
    var printed = ee.String('from ')
        .cat(ee.Date(range.get('min')).format('YYYY-MM-dd'))
        .cat(' to ')
        .cat(ee.Date(range.get('max')).format('YYYY-MM-dd'));
    return printed;
}



var computeFlood = function (area) {
    // rename selected geometry feature 
    map.clear();

    var geometry;

    if (area == 'Concepcion') {
        geometry = concepcion;
    } else {
        geometry = lapaz;
    }


    var aoi = ee.FeatureCollection(geometry);

    // Load and filter Sentinel-1 GRD data by predefined parameters 
    var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
        .filter(ee.Filter.eq('orbitProperties_pass', pass_direction))
        .filter(ee.Filter.eq('resolution_meters', 10))
        .filterBounds(aoi)
        .select(polarization);

    // Select images by predefined dates
    before_collection = collection.filterDate(before_start, before_end);
    after_collection = collection.filterDate(after_start, after_end);

    // Create a mosaic of selected tiles and clip to study area
    var before = before_collection.mosaic().clip(aoi);
    var after = after_collection.mosaic().clip(aoi);

    // Apply reduce the radar speckle by smoothing  
    var smoothing_radius = 50;
    var before_filtered = before.focal_mean(smoothing_radius, 'circle', 'meters');
    var after_filtered = after.focal_mean(smoothing_radius, 'circle', 'meters');


    //------------------------------- FLOOD EXTENT CALCULATION -------------------------------//

    // Calculate the difference between the before and after images
    var difference = after_filtered.divide(before_filtered);

    // Apply the predefined difference-threshold and create the flood extent mask 
    var threshold = difference_threshold;
    var difference_binary = difference.gt(threshold);

    // Refine flood result using additional datasets

    // Include JRC layer on surface water seasonality to mask flood pixels from areas
    // of "permanent" water (where there is water > 10 months of the year)
    var swater = ee.Image('JRC/GSW1_0/GlobalSurfaceWater').select('seasonality');
    var swater_mask = swater.gte(10).updateMask(swater.gte(10));

    //Flooded layer where perennial water bodies (water > 10 mo/yr) is assigned a 0 value
    var flooded_mask = difference_binary.where(swater_mask, 0);
    // final flooded area without pixels in perennial waterbodies
    var flooded = flooded_mask.updateMask(flooded_mask);

    // Compute connectivity of pixels to eliminate those connected to 8 or fewer neighbours
    // This operation reduces noise of the flood extent product 
    var connections = flooded.connectedPixelCount();
    flooded = flooded.updateMask(connections.gte(8));

    // Mask out areas with more than 5 percent slope using a Digital Elevation Model 
    var DEM = ee.Image('WWF/HydroSHEDS/03VFDEM');
    var terrain = ee.Algorithms.Terrain(DEM);
    var slope = terrain.select('slope');
    flooded = flooded.updateMask(slope.lt(5));

    // Calculate flood extent area
    // Create a raster layer containing the area information of each pixel 
    var flood_pixelarea = flooded.select(polarization)
        .multiply(ee.Image.pixelArea());

    // Sum the areas of flooded pixels
    // default is set to 'bestEffort: true' in order to reduce compuation time, for a more 
    // accurate result set bestEffort to false and increase 'maxPixels'. 
    var flood_stats = flood_pixelarea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 10, // native resolution 
        //maxPixels: 1e9,
        bestEffort: true
    });

    // Convert the flood extent to hectares (area calculations are originally given in meters)  
    flood_area_ha = flood_stats
        .getNumber(polarization)
        .divide(10000)
        .round();


    //------------------------------  DISPLAY PRODUCTS  ----------------------------------//

    // Before and after flood SAR mosaic
    map.centerObject(aoi, 12);
    map.addLayer(before_filtered, { min: -25, max: 0 }, 'Before Flood', 0);
    map.addLayer(after_filtered, { min: -25, max: 0 }, 'After Flood', 1);

    // Difference layer
    map.addLayer(difference, { min: 0, max: 2 }, "Difference Layer", 0);

    // Flooded areas
    map.addLayer(flooded, { palette: "0000FF" }, 'Flooded areas');

    dates(after_collection).evaluate(function (val) { number1.setValue(val) }), numberVIS;
    dates(after_collection).evaluate(function (val) { text2_2.setValue('based on Senintel-1 imagery ' + val) });
    flood_area_ha.evaluate(function (val) { number2.setValue(val + ' hectares') }), numberVIS;

    // Map.add(results);
    map.add(legend);

}

//---------------------------------- MAP PRODUCTION --------------------------------//

//-------------------------- Display the results on the map -----------------------//

// set position of panel where the text will be displayed 
var results = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px',
        width: '350px'
    }
});




//Prepare the visualtization parameters of the labels 
var textVis = {
    'margin': '0px 8px 2px 0px',
    'fontWeight': 'bold'
};
var numberVIS = {
    'margin': '0px 0px 15px 0px',
    'color': 'bf0f19',
    'fontWeight': 'bold'
};
var subTextVis = {
    'margin': '0px 0px 2px 0px',
    'fontSize': '12px',
    'color': 'grey'
};


var titleTextVis = {
    'margin': '10px 0px 15px 0px',
    'fontSize': '18px',
    'font-weight': '',
    'color': '3333ff'
};

var titleTextVis2 = {
    'margin': '10px 0px 0px 0px',
    'fontSize': '18px',
    'font-weight': '',
    'color': '3333ff'
};

var titleTextVis3 = {
    'margin': '10px 0px',
    'fontSize': '20px',
    'font-weight': '600',
    'color': '000000'
};

var appTitle = ui.Label('Typhoon Damage Estimate', titleTextVis3);
results.add(appTitle);

var textInsVis = {
    'margin': '0px 8px 2px 0px'
};
var textIns = ui.Label('The flood extent is created using a change detection approach on Sentinel-1 (SAR) data. To start, select the typhoon event and the location on the the dropdown boxes', textInsVis);
results.add(textIns);

var EventTitle = ui.Label('Event:', titleTextVis2);
results.add(EventTitle);
// Define dropdown
var drop2 = ui.Select({
    items: eventTitle.getInfo(),
    //items: all.getInfo(),
    // onChange: computeFlood
})
results.add(drop2);


var Selecttitle = ui.Label('Location:', titleTextVis2);
results.add(Selecttitle);


// Define dropdown
var drop = ui.Select({
    items: some.getInfo(),
    //items: all.getInfo(),
    onChange: computeFlood
})
results.add(drop);


// Create lables of the results 
// Titel and time period
var title = ui.Label('Results', titleTextVis);
var text1 = ui.Label('Flood status between:', textVis);
var number1 = ui.Label(after_start.concat(" and ", after_end), numberVIS);

// Alternatively, print dates of the selected tiles
var number1 = ui.Label('Select a location...', numberVIS);

// Estimated flood extent 
var text2 = ui.Label('Estimated flood extent:', textVis);
var text2_2 = ui.Label('Select a location...', subTextVis);
var number2 = ui.Label('Select a location...', numberVIS);


// Disclaimer
var text6 = ui.Label('Disclaimer: This product has been derived automatically without validation data. All geographic information has limitations due to the scale, resolution, date and interpretation of the original source materials. No liability concerning the content or the use thereof is assumed by the producer.', subTextVis)

// Produced by...
var text7 = ui.Label('Script produced by: UN-SPIDER Decembe 2019', subTextVis)

// Add the labels to the panel 
results.add(ui.Panel([
    title,
    text1,
    number1,
    text2,
    text2_2,
    number2,
    text6,
    text7
]
));

// Add the panel to the map 
ui.root.add(results);


//----------------------------- Display legend on the map --------------------------//

// Create legend (*credits to thisearthsite on Open Geo Blog: https://mygeoblog.com/2016/12/09/add-a-legend-to-to-your-gee-map/)
// set position of panel
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px',
    }
});

// Create legend title
var legendTitle = ui.Label('Legend', titleTextVis);

// Add the title to the panel
legend.add(legendTitle);

// Creates and styles 1 row of the legend.
var makeRow = function (color, name) {

    // Create the label that is actually the colored box.
    var colorBox = ui.Label({
        style: {
            backgroundColor: color,
            // Use padding to give the box height and width.
            padding: '8px',
            margin: '0 0 4px 0'
        }
    });

    // Create the label filled with the description text.
    var description = ui.Label({
        value: name,
        style: { margin: '0 0 4px 6px' }
    });

    // return the panel
    return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
    });
};

//  Palette with the colors
var palette = ['#0000FF', '#30b21c', 'grey'];

// name of the legend
var names = ['potentially flooded areas', 'affected cropland'];

// Add color and and names
for (var i = 0; i < 1; i++) {
    legend.add(makeRow(palette[i], names[i]));
}

// Create second legend title to display exposed population density
var legendTitle2 = ui.Label({
    value: 'Exposed population density',
    style: {
        fontWeight: 'bold',
        fontSize: '15px',
        margin: '10px 0 0 0',
        padding: '0'
    }
});

// add legend to map (alternatively you can also print the legend to the console)

ui.root.add(map);
map.centerObject(concepcion,12)
map.add(legend);
