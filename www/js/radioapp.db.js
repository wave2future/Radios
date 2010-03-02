/* http://developer.apple.com/safari/library/documentation/iPhone/Conceptual/SafariJSDatabaseGuide/UsingtheJavascriptDatabase/UsingtheJavascriptDatabase.html */





if(!RA) var RA = {};

RA.db = function() {
  var db_ = null;
  
  var defaultStations = [
                          [ "DRS 1"     , "http://glb-stream11.streamserver.ch/1/regi_zh_sh/mp3_128"],
                         [ "DRS 2"     , "http://glb-stream13.streamserver.ch/1/drs2/mp3_128"],
                          [ "DRS 3"     , "http://zlz-stream10.streamserver.ch/1/drs3/mp3_128"],
                          [ "DRS 4 News", "http://zlz-stream11.streamserver.ch/1/drs4news/mp3_128"],
                          [ "Virus"     , "http://zlz-stream12.streamserver.ch/1/drsvirus/mp3_128"],
                          [ "Radio 1", "http://stream.radio1.ch:8000/radio1"]

];
  
  var ERR_NONDB = 0;
  var ERR_OTHER = 1;
  var ERR_VERSION_MISMATCH = 2;
  var ERR_RESULTSIZE_EXCEEDED = 3;
  var ERR_MAXSIZE_EXCEEDED = 4;
  var ERR_LOCK_ERROR = 5; // contention
  var ERR_CONSTRAINT = 6;
  
  
  
  
  function upgradeSuccess() { console.log('Successfully upgraded db.'); }
  function upgradeError(error) { console.log('Failed upgrading db.'); return true; /* treat all errs as fatal */ }
  /*! Return TRUE for fatal error */
  function errorHandler(transaction, error) {
    alert('ERROR[' + error.code + ']: '+error.message);
    return true;
  }

  /*! This is used as a data handler for a request that should return no data. */
  function nullDataHandler(transaction, results) { }
  
  function createTables(transaction) {
    //transaction.executeSql('DROP TABLE IF EXISTS stations');
    transaction.executeSql('CREATE TABLE IF NOT EXISTS stations(id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE ON CONFLICT REPLACE, stream TEXT NOT NULL, listened_at DATE );', [], nullDataHandler, errorHandler);
  }
  
  // FIXME need something better.. this restores db id on each insert (
  function insertDefaults(transaction) {
  // insert default data
    var query = 'INSERT INTO stations(name, stream, listened_at) VALUES(?, ?, NULL);';
    for( var i=0; i < defaultStations.length; ++i ) {
      transaction.executeSql(query, defaultStations[i], nullDataHandler, errorHandler);
    }
  }

  return {
    upgrade:function(transaction, from, to) {
      console.log('Upgrading db version from  ' + from + ' to ' + to);
      createTables(transaction);
    },

    init: function() {
      var opts = {
        shortName:'radioapp_stations_orly', 
        version:'1.0', 
        displayName:'Stations of RadioApp', 
        maxSize:524288 // 512KiB
      };
      try {
        if(!window.openDatabase) {
          alert('Need window.openDatabase :/');
        } else {

/*
          db_ = openDatabase(opts.shortName, "", opts.displayName, opts.maxSize);
          
          if( db_.version == '' ) {
            db_.transaction(function(trans) { createTables(trans); });
          } else if( db_.version != opts.version ) {
            try {
              if(!db_.changeVersion)
                 alert('Db version changing not supported by this browser');
              else {
                db_.changeVersion(db_.version, opts.version, function(transaction) { RA.db.upgrade(transaction, db_.version, opts.version); }, upgradeSuccess, upgradeError);
              }
  
            } catch(e) {
              alert('Changing db version failed: ' + e);
            }
          }
          */
          db_ = openDatabase(opts.shortName, opts.version, opts.displayName, opts.maxSize);
          db_.transaction(function(transaction) { createTables(transaction); insertDefaults(transaction); });
          debug.log('Current db version: '+db_.version + ' (want ' + opts.version + ')');
        }
        return db_;
      } catch(e) {
        if(e.code == ERR_VERSION_MISMATCH) {
          alert('Invalid db version.');
        } else {
          alert('Unknown error: ' + e);
        }
      }
    },
    
    close: function() {
      
    },
    updateListenAt: function(id) {
      db_.transaction(function(t) {
        t.executeSql('UPDATE stations SET listened_at = datetime("now","localtime") WHERE id = ?', [ id ], nullDataHandler, errorHandler);
      });
    },
    getStation: function(id, resultHandler, updateListen) {
      updateListen = updateListen || false;
      
      if( updateListen )
        this.updateListenAt(id);
        
      db_.transaction(function(t) {
        t.executeSql("SELECT id, name, stream, listened_at FROM stations WHERE id = ?", [ id ] , function(t, results) {
          if( results.rows.length == 0 )
            resultHandler(null);
          else 
            resultHandler(results.rows.item(0));
        }, errorHandler);
      });
    },
    getStations: function(resultHandler, filter) {
      var where = '';
      if ( filter ) {
        where = " WHERE name LIKE '%" + filter + "%';"; // FIXME EEEEESCAPE!
      }
      db_.transaction(function(t) {
        t.executeSql("SELECT id, name, stream, listened_at FROM stations " + where + " ORDER BY listened_at DESC", [ ] , function(t, results) {
          resultHandler(results.rows);
        }, errorHandler);
      });
    },
    insertStation: function(station) {
      db_.transaction(function(t) {
        var query = 
        t.executeSql('INSERT INTO stations(name, stream, listened_at) VALUES(?, ?, NULL);', [ station.name, station.stream ], nullDataHandler, errorHandler);
      });
    }
  };
}();



document.addEventListener("deviceready", function() { RA.db.init(); populateStations(); autoSearch()}, false);

function autoSearch() {
  var searchel = document.getElementById('search-field');
  searchel.onkeyup = function(ev) {
    populateStations(searchel.value);
  };
}

function populateStations(filter) {  
  RA.db.getStations(function(stations) {
    var ul = document.createElement('ul');
    var li, txt;
    var playing = document.createElement('span');
    var playingOn = document.createTextNode('On');
    playing.setAttribute('class', 'playing');
    playing.appendChild(playingOn);
    
    for( var i=0; i<stations.length; ++i ) {
      console.log(stations.item(i).name);
      li = document.createElement('li');
      txt = document.createTextNode(stations.item(i).name);
      li.appendChild(txt);
      li.setAttribute('id', 'station-'+ stations.item(i).id);
      li.onclick = function(ev) { 
      
        var id = this.getAttribute('id').split('-')[1]; 
        RA.db.getStation(id, function(station) {
          ev.target.appendChild(playing);
                         debug.log(station.stream);
          playSound(station.stream);
        }, true);
        
      };
      ul.appendChild(li);
    }
    // remove current nav
    var statel = document.getElementById("stations");
    if( statel.hasChildNodes() ) {
      while( statel.childNodes.length >= 1 ) 
        statel.removeChild(statel.firstChild);
    }
    // append updated nav
    statel.appendChild(ul);
  }, filter);
}
