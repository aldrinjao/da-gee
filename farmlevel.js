
var subTextVis = {
    'margin': '20px 5px 5px 5px',
    'fontSize': '12px',
    'color': 'grey'
};
var text6 = ui.Label('Disclaimer: This product has been derived automatically without validation data. All geographic information has limitations due to the scale, resolution, date and interpretation of the original source materials. No liability concerning the content or the use thereof is assumed by the producer.', subTextVis)

var palette = ['964B00',
    'f9f9f9dd',
    '8fce00dd',
    '274E13dd',
    'FFD700dd',
    '0b5394dd'];

var typhoonpalette = ['a64452',
    'a64452',
    'red',
    'red',
    'red',
    'red'];


var pathvis = typhoon.style({
    fillColor: '0000AA30',
    color: '0000AAff'
});


//initialize map
function addMap(checked) {

    var outlinevis = outline.style({
        fillColor: '00000020',
        color: '000000ff'
    });


    map.addLayer(outlinevis, null, 'Boundary');

    var statusStyles = ee.Dictionary({
        1: { fillColor: palette[0], color: '01662090' },
        2: { fillColor: palette[1], color: '01662090' },
        3: { fillColor: palette[2], color: '01662090' },
        4: { fillColor: palette[3], color: '01662090' },
        5: { fillColor: palette[4], color: '01662090' },
        6: { fillColor: palette[5], color: '01662090' },
    });


    fctable = fctable.map(function (feature) {
        return feature.set('style', statusStyles.get(feature.get('status')));
    });

    var fcVisCustom = fctable.style({
        styleProperty: 'style'
    });
    map.addLayer(fcVisCustom, null, 'Farm Plots');


    if (checked) {
        var mapped = typhoon.map(function (feature) {
            var feat1 = ee.Feature(feature);
            var mapped1 = fctable.map(function (feat2) {
                feat2 = ee.Feature(feat2);
                var intersection = feat2.intersection(feat1, ee.ErrorMargin(1));

                return intersection;
            })
            return mapped1;

        })
            .flatten();


        // Now set properties on non-null features.
        mapped = mapped.map(function (intersection) {
            return intersection.set({
                'Intersect': intersection.area().divide(1000 * 1000)
            })
        }).filter(ee.Filter.gt('Intersect', 0))
            .filter(ee.Filter.notEquals('status', 1))
            .filter(ee.Filter.notEquals('status', 5));
        print(mapped);

        mapped.aggregate_sum('Area').evaluate(function (areaValue) {
            panel.widgets().set(15, ui.Label({ value: areaValue.toFixed(2) + ' ha', style: { whiteSpace: 'pre' } }));
        });


        var damagedVis = mapped.style({
            color: '00000000',
            fillColor: 'FF0000ee',  // with alpha set for partial transparency
        });

        map.addLayer(damagedVis, null, 'Potential Damage');

    }

    map.style().set('cursor', 'crosshair');
    map.onClick(getProps);

}
function getHistoricalNDVI(geometry) {
    //retrieve data from table
    var data = ee.List([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    var chart = ui.Chart.array.values(data, 0)
        .setChartType('LineChart')
        .setOptions({
            title: 'NDVI time series',
            hAxis: { title: 'Date', viewWindow: { min: 0, max: 15 } },
            vAxis: { title: 'NDVI', viewWindow: { min: -1, max: 1 } },

            curveType: 'function',
            series: {
                0: { lineWidth: 1, color: 'blue', pointSize: 1, },
            },
        });


    panel.widgets().set(11, chart);
}


//reset maps
var removeLayer = function (name) {
    var layers = map.layers()
    // list of layers names
    var names = []
    layers.forEach(function (lay) {
        var lay_name = lay.getName()
        names.push(lay_name)
    })

    // get index
    var index = names.indexOf(name)
    if (index > -1) {
        // if name in names
        var layer = layers.get(index)
        map.remove(layer)
    } else {
    }
}




function getProps(loc) {

    removeLayer('Selected');
    loc = ee.Dictionary(loc);
    var point = ee.Geometry.Point(loc.getNumber('lon'), loc.getNumber('lat'));
    var thisFeature = fctable.filterBounds(point).first();
    var fromList = ee.FeatureCollection([thisFeature]);

    getHistoricalNDVI(fromList);

    var fcVis = fromList.style({
        fillColor: 'FFFF0000',  // with alpha set for partial transparency
        lineType: 'dotted',
        color: 'yellow'
    });

    map.addLayer(fcVis, null, 'Selected');

    var props = thisFeature.toDictionary();

    props.evaluate(function (props) {

        var statusLabel = [
            'No Crop',
            'Vegetative',
            'Reproductive',
            'Maturity',
            'Harvested',
            'Category 6'

        ];


        var data = [];
        var datetime = [];
        var count = -1;
        Object.keys(props).forEach(function (i) {
            var t = i.split("_");
            if (t[0] == "n") {
                var temp = t[2] + " " + t[3] + ", 20" + t[1];
                data.push(props[i]);
                datetime.push(temp);
                count++;

            }
        });

        var chartt = ui.Chart.array.values(data, 0, datetime)
            .setSeriesNames(['NDVI'])
            .setChartType('LineChart')
            .setOptions({
                title: 'NDVI time series',
                hAxis: { title: 'Date' },
                vAxis: { title: 'NDVI', viewWindow: { min: -1, max: 1 } },
                curveType: 'function',
                series: {
                    0: { lineWidth: 1, color: 'blue', pointSize: 1, },
                },
            });
        var statusIndex = props['status'] - 1;

        panel.widgets().set(6, ui.Label({ value: datetime[count], style: { whiteSpace: 'pre' } }));
        panel.widgets().set(8, ui.Label({ value: props['name'], style: { whiteSpace: 'pre' } }))
        panel.widgets().set(10, ui.Label({ value: statusLabel[statusIndex], style: { whiteSpace: 'pre' } }));
        panel.widgets().set(11, chartt);




    });

}


var checkbox = ui.Checkbox('Show typhoon path', false);

checkbox.onChange(function (checked) {
    // Shows or hides the first map layer based on the checkbox's value.

    map.clear();
    map.centerObject(fctable, 14.5);
    map.setOptions('SATELLITE');
    map.add(legend)

    if (checked) {
        map.addLayer(pathvis, null, 'Path')
    }

    addMap(checked);


});


var leftPanelStyle = {
    width: '400px',
    padding: '10px 10px 10px 20px'
};


var panel = ui.Panel({ style: leftPanelStyle });
var titleStyle = { fontSize: '20px', fontWeight: 'bold' };
var infoTitleStyle = { fontSize: '16px', fontWeight: 'bold' };
var appDescStyle = { fontSize: '14px', fontWeight: 'normal' };
var title = ui.Label({ value: 'Farm-Level NDVI', style: titleStyle });
var infoTitle = ui.Label({ value: 'Data from Shapefile', style: infoTitleStyle });
var pathTitle = ui.Label({ value: 'Typhoon Damage', style: titleStyle });
var appDesc = ui.Label({ value: 'Historical data on vegetation to determine current planting status.\nClick on polygons (farm plots) to see the available computed historical NDVI value within that farm.', style: appDescStyle });
var info = ui.Label({ value: 'Click on a feature', style: { whiteSpace: 'pre', fontWeight: 'bold', fontSize: '24px' } });

var plotIDTitle = ui.Label({ value: 'Farm ID', style: infoTitleStyle });
var plotStatusTitle = ui.Label({ value: 'Planting Status', style: infoTitleStyle });

var plotID = ui.Label({ value: '-', style: appDescStyle });
var plotStatus = ui.Label({ value: '-', style: appDescStyle });


var dateTitle = ui.Label({ value: 'Planting Status as of', style: infoTitleStyle });
var dateLabel = ui.Label({ value: '-', style: appDescStyle });

var totalAreaTitle = ui.Label({ value: 'Total Area of Plots Surveyed', style: infoTitleStyle });
var totalAreaLabel = ui.Label({ value: '-', style: appDescStyle });


var damageAreaTitle = ui.Label({ value: 'Total Area of Potential Damage Based on Typhoon Path', style: infoTitleStyle });
var damageAreaLabel = ui.Label({ value: '-', style: appDescStyle });


var titleTextVis = {
    'margin': '10px 0px 15px 0px',
    'fontSize': '18px',
    'font-weight': '',
    'color': '3333ff'
};

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

// name of the legend
var names = ['No crop', 'Vegetative', 'Reproductive', 'Maturity', 'Harvested', 'n/a'];

// Add color and and names
for (var i = 0; i < 6; i++) {
    legend.add(makeRow(palette[i], names[i]));
}


panel.add(title);
panel.add(infoTitle);
panel.add(appDesc);
panel.add(totalAreaTitle);
panel.add(totalAreaLabel);
panel.add(dateTitle);
panel.add(dateLabel);
panel.add(plotIDTitle);
panel.add(plotID);
panel.add(plotStatusTitle);
panel.add(plotStatus);
panel.add(info);
panel.add(pathTitle);
panel.add(checkbox);
panel.add(damageAreaTitle);
panel.add(damageAreaLabel);
panel.add(text6);

ui.root.clear();
ui.root.add(panel);
var map = ui.Map();
ui.root.add(map);
fctable.aggregate_sum('Area').evaluate(function (areaValue) {
    panel.widgets().set(4, ui.Label({ value: areaValue.toFixed(2) + ' ha', style: { whiteSpace: 'pre' } }));
});

// map.setCenter(120.68, 15.43, 14);
map.centerObject(fctable, 14.5);
map.setOptions('SATELLITE');
map.add(legend)
addMap(false);