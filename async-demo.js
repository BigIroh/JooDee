<:
    var fs = require('fs');
    var http = require('http');
    
    var files = null;
    var get = null;
    var build = function(part) {
        if(files && get) {
            :>
            <!DOCTYPE html>
            <html>
                <body>
                <:
                    for(f in files) {
                        :>
                        <:: files[f] :>,&nbsp;
                        <:
                    }
                :>
                    <pre>
                        <:: get :>
                    </pre>
                </body>
            </html>
            <:
            Response.end();
        }
    }

    fs.readdir('.', function(err, f) {
        files = f;
        build();
    });

    http.get('http://news.ycombinator.com', function(res) {
        var page = ''
        res.on('data', function(chunk) {
            page += chunk;
        });
        res.on('end', function() {
            get = page;
            build();
        });
    });
:>