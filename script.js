$(function(){
    var markers={};
    var callbacks={};
	var unitDisplays={};
	var unitStatusDisplays={};
	var unitStatuses={};
    var unitsToDelete=new Array();
    var sirensOn={};
	var titleSet={};
    var waypoints={};
    var unitWaypoints={};
    socket=io.connect('http://gtacad.aws.af.cm:8415/client');
    
    var policeMarkerIcon = {
        url: "blips/radar_police2.fw.png",
        anchor: {x: 8, y:8}
    };
    
    var policeMarkerIconSiren = {
        url: "blips/sirenCar.gif",
        anchor: {x: 8, y:8}
    };
    
    var policeMarkerShadow = {
        url: "blips/shadow.fw.png",
        anchor: {x: 16, y:16}
    };
    
    var waypointMarkerIcon = {
        url: "blips/radar_waypoint.fw.png",
        anchor: {x: 16, y:16}
    };
    
    var mapOptions = {
        minZoom: 4,
        maxZoom: 7,
        isPng: true,
        mapTypeControl: false,
        streetViewControl: false,
        center: new google.maps.LatLng(82,-144),
        zoom: 4,
        mapTypeControlOptions: {
            mapTypeIds: ['custom', google.maps.MapTypeId.ROADMAP],
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        }
    };
	
	var infoWindowOptions = {
		content: "<div class='infoWindow'>testing</div>"
	};
	////////////// Waypoint functions ////////////////////
	
	function createLocalWaypoint(UUID, position){
		waypoints[UUID]=newWaypointMarker(gameToMap(position));
		google.maps.event.addListener(waypoints[UUID], "rightclick", function(){
			infoWindow.open(map, waypoints[UUID]);
		});
		refreshWaypoints();
	}
	
	function addWaypointToUnit(UUID, unitID){
		removeWaypointFromUnit(unitID);
		unitWaypoints[unitID]=UUID;
		refreshWaypoints();
	}
    
    function assignWaypoint(latlng, unitEls){
        if(unitEls.length>0){
			var UUID = createUUID();
            var position = mapToGame(latlng);
            createLocalWaypoint(UUID, position);
			createRemoteWaypoint(UUID, position);
            $.each(unitEls, function(index, unitDisplay){
				if($(unitDisplay).hasClass("ui-selected")){
					unitID = $(unitDisplay).data("unitID");
					if(unitID){
						addWaypointToUnit(UUID, unitID);
						socket.emit("setWaypoint", UUID, unitID);
					}
				}
            });
        }
    }
	
	function createRemoteWaypoint(UUID, position){
			socket.emit("createWaypoint", UUID, position);
	}
	
	function handleWaypoints(waypointsFromServer, unitWaypointsFromServer){
		$.each(waypointsFromServer, function(UUID, position){
			createLocalWaypoint(UUID, position);
		});
		unitWaypoints=unitWaypointsFromServer;
	}
	
	function newWaypointMarker(latlng){
		return new google.maps.Marker({
			position: latlng,
            map: map,
            optimized: false,
            flat: true,
            icon: waypointMarkerIcon
        });
	}
	
	function removeWaypoint(UUID){
		if(UUID && waypoints[UUID]){
			$.each(unitWayponts, function(index, value){
				if(UUID==value) delete unitWaypoints[index];
			});
			waypoints[UUID].setMap(null);
			maps.google.event.clearInstanceListeners(waypoints[UUID]);
			delete waypoints[UUID];
		}
	}
    
    function removeWaypointFromUnit(unitID){
        if(unitID && unitWaypoints[unitID] && waypoints[unitWaypoints[unitID]]){
			var UUID = unitWaypoints[unitID];
            var waypoint=waypoints[UUID];
            var timesUsed=0;
            $.each(unitWaypoints, function(index, value){ //make sure no other units are using it
                if(UUID===value) timesUsed++;
            });
            if(timesUsed<2){
				waypoint.setMap(null);
				google.maps.event.clearInstanceListeners(waypoints[UUID]);
				delete waypoints[UUID];
				delete unitWaypoints[unitID];
			}
        }
    }
	
	function refreshWaypoints(){
		var waypointsToShow = new Array();
		$.each($("#unitDisplay").children(), function(index, unitDisplay){
			if($(unitDisplay).hasClass("ui-selected")){
				var unitID = $(unitDisplay).data("unitID");
				if(unitID && unitWaypoints[unitID]) waypointsToShow.push(unitWaypoints[unitID]);
			}
		});
		$.each(waypoints, function(index, waypoint){
				if($.inArray(index, waypointsToShow)!=-1){
					waypoint.setMap(map);
				}
				else{
					waypoint.setMap(null);
				}
		});
	}
	
	////////////// Unit functions ////////////////////
	
	function newMarker(){
		return new google.maps.Marker({
			position: new google.maps.LatLng(0,0),
            map: map,
            optimized: false,
            flat: true,
            icon: policeMarkerIcon,
            shadow: policeMarkerShadow
        });
	}
    
    
	
	function newUnitDisplay(){
		display={};
		display.el=$("<div></div>").addClass("unitDisplay");
		display.name=$("<span></span>").addClass("unitName");
		display.ID=$("<span></span>").addClass("unitID");
		display.location=$("<span></span>").addClass("unitLocation");
		display.el.append(display.ID).append(display.name).append(display.location);
		return display;
	}
	
	function newUnitStatusDisplay(){
		statusDisplay={};
		statusDisplay.el = $("<tr></td>");
		statusDisplay.ID = $("<td></td>");
		statusDisplay.status = $("<td></td>");
		statusDisplay.location = $("<td></td>");
		statusDisplay.el.append(statusDisplay.ID).append(statusDisplay.status).append(statusDisplay.location);
		return statusDisplay;
	}
    
    function renderMarkerShadow(unitID){
        if(unitID && markers[unitID]){
            markers[unitID].setFlat(false);
        }
    }
    
    function removeMarkerShadow(unitID){
        if(unitID && markers[unitID]){
            markers[unitID].setFlat(true);
        }
    }
    
    function handleHeartbeats(data){
        $.each(data, function(index, unit){
		//console.log(unit);
            if(markers[unit.unitID]) marker=markers[unit.unitID];
            else{
                marker = newMarker();
                markers[unit.unitID]=marker;
            }
            marker.setPosition(gameToMap({x:parseFloat(unit.x), y:parseFloat(unit.y)}));
			
			if(unitDisplays[unit.unitID]) display=unitDisplays[unit.unitID];
            else{
                display = newUnitDisplay();
                display.el.mouseover(function(){
                    renderMarkerShadow(unit.unitID);
                }).mouseout(function(){
                    removeMarkerShadow(unit.unitID);
                }).data("unitID", unit.unitID);
				$("#unitDisplay").append(display.el);
                unitDisplays[unit.unitID]=display;
            }
			display.name.text(unit.name);
			display.ID.text(unit.unitID);
            locationString=unit.street1;
            if(unit.street2) locationString+=" near "+unit.street2;
            if(unit.street1) display.location.text("on "+locationString);
			
			if(unitStatusDisplays[unit.unitID]) statusDisplay=unitStatusDisplays[unit.unitID];
			else{
				statusDisplay = newUnitStatusDisplay();
				statusDisplay.ID.html(unit.unitID);
				unitStatusDisplays[unit.unitID]=statusDisplay;
				$("#unitStatusesBody").append(statusDisplay.el);
			}
			statusDisplay.status.html(unitStatuses[unit.unitID]);
			statusDisplay.location.html(locationString);
            
            if(!sirensOn[unit.unitID] && unit.sirenOn){
                marker.setIcon(policeMarkerIconSiren);
                sirensOn[unit.unitID]=true;
            }
            else if(sirensOn[unit.unitID] && !unit.sirenOn){
                marker.setIcon(policeMarkerIcon);
				sirensOn[unit.unitID]=false;
            }
			if(!titleSet[unit.unitID] && unit.name){
				titleSet[unit.unitID]=true;
				marker.setTitle(unit.unitID+": "+unit.name);
			}
        });
        for(var i=0; i<unitsToDelete.length; i++){
            if(markers[unitsToDelete[i]]) markers[unitsToDelete[i]].setMap(null);
            delete markers[unitsToDelete[i]];
			if(unitDisplays[unitsToDelete[i]]) unitDisplays[unitsToDelete[i]].el.remove();
			delete unitDisplays[unitsToDelete[i]];
			removeWaypointFromUnit(unitsToDelete[i]);
			if(unitWaypoints[unitsToDelete[i]]) delete unitWaypoints[unitsToDelete[i]];
        }
        unitsToDelete.length=0;
        $("#unitStatuses").trigger("update"); 
    }

    
    
    function createUUID() {
        // http://www.ietf.org/rfc/rfc4122.txt
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";

        var uuid = s.join("");
        return uuid;
    }
    
    function isFunction(functionToCheck) {
     var getType = {};
     return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }
    
    function callbackEmit(socket, command, data, callback){
        var UUID=createUUID();
        var args={};
        args.UUID=UUID;
        args.command=command;
        args.data=data;
        callbacks[UUID]=callback;
        socket.emit("callbackEmit", args);
    }
    
    function gameToMap(position){
        var widthConversion = 44/5632;
        var heightConversion = 34/4096;
        var y=-position.y*heightConversion*.96;
        var x=position.x*widthConversion*1.025;
        y+=22;
        x+=22;
        return map.getProjection().fromPointToLatLng(new google.maps.Point(x, y), true);
        
        /*center: 22, 22
        top left: 2, 2
        bottom right: 46, 34
        width: 44
        height: 32
        5632
        4096*/
    }
    
    function mapToGame(latlng){
        var point = map.getProjection().fromLatLngToPoint(latlng);
        var x = point.x-22;
        var y = point.y-22;
        var widthConversion = 44/5632;
        var heightConversion = 34/4096;
        y=-y/heightConversion/.96;
        x=x/widthConversion/1.025;
        return {x: x, y: y};
    }
    
    function CustomMapType() {
    }

    CustomMapType.prototype.tileSize = new google.maps.Size(256,256);
    CustomMapType.prototype.maxZoom = 7;
    CustomMapType.prototype.getTile = function(coord, zoom, ownerDocument) {
        var div = ownerDocument.createElement('DIV');
        var baseURL = "map/tiles/tiles";
        var x = coord.x;
        var y = coord.y;
        var setBackground=true;
        switch(zoom){
            case 7:
                if(x<1 || y<1 || x>22 || y>16) setBackground=false;
                break;
            case 6:
                if(x<0 || y<0 || x>11 || y>8) setBackground=false;
                break;
            case 5:
                if(x<0 || y<0 || x>5 || y>4) setBackground=false;
                break;
            case 4:
                if(x<0 || y<0 || x>2 || y>2) setBackground=false;
                break;
        }
        baseURL += zoom + '_' + x + '_' + y + '.png';
        div.style.width = this.tileSize.width + 'px';
        div.style.height = this.tileSize.height + 'px';
        if(setBackground) div.style.backgroundImage = 'url(' + baseURL + ')';
        return div;
    };
    CustomMapType.prototype.name = "Custom";
    CustomMapType.prototype.alt = "Tile Coordinate Map Type";
    var CustomMapType = new CustomMapType();
	var infoWindow = new google.maps.InfoWindow(infoWindowOptions);
	var map = new google.maps.Map(document.getElementById("map"),mapOptions);
    map.mapTypes.set('custom', CustomMapType);
    map.setMapTypeId('custom');

    
    google.maps.event.addDomListener(map, "click", function(e){
        assignWaypoint(e.latLng, $(".ui-selected", "#unitDisplay"));
    }, true)
	
	socket.on("allHeartbeats", handleHeartbeats);
	socket.on("removeWaypointFormUnit", removeWaypointFromUnit);
	socket.on("allWaypoints", handleWaypoints);
	socket.on("createLocalWaypoint", createLocalWaypoint);
	socket.on("addWaypointToUnit", addWaypointToUnit);
	socket.on("deleteUnit", function(unitID){
        unitsToDelete.push(unitID);
    });
	socket.on("callback", function(data){
        if(data.UUID!=null && callbacks[data.UUID] && isFunction(callbacks[data.UUID])){
            callbacks[data.UUID](data.data);
            delete callbacks[data.UUID];
        }
    });
    
    $("#unitDisplay").selectable({
        filter: ".unitDisplay",
        stop: refreshWaypoints
    });
	
	$("#unitStatuses").dialog({
		autoOpen: false,
		width: 700,
		height: 200,
		minWidth: 350
	}).tablesorter();
	$("#openUnitStatus").button().click(function(){
		$("#unitStatuses").dialog("open");
	});
	
	$("body").disableSelection();
});