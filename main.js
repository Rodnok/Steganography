window.onload = function() {

    var input = document.getElementById('file');
    input.addEventListener('change', importImage);


    var encodeButton = document.getElementById('encode');
    encodeButton.addEventListener('click', encode);


    var decodeButton = document.getElementById('decode');
    decodeButton.addEventListener('click', decode);
};

// limit wiadomosci
var maxMessageSize = 1000;

// zaladuj image do canvas i wyswietl
var importImage = function(e) {
    var reader = new FileReader();

    reader.onload = function(event) {
        // podglad
        document.getElementById('preview').style.display = 'block';
        document.getElementById('preview').src = event.target.result;

        document.getElementById('message').value = '';
        document.getElementById('messageDecoded').innerHTML = '';

        // wczytaj dane do canvas
        var img = new Image();
        img.onload = function() {
            var ctx = document.getElementById('canvas').getContext('2d');
            ctx.canvas.width = img.width;
            ctx.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            decode();
        };
        img.src = event.target.result;
    };

    reader.readAsDataURL(e.target.files[0]);
};

// enkryptuj obraz i zapisz
var encode = function() {
    var message = document.getElementById('message').value;
    var output = document.getElementById('output');
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');


        message = JSON.stringify({'text': message});


    // alert jezeli widomsc za duza
    var pixelCount = ctx.canvas.width * ctx.canvas.height;
    if ((message.length + 1) * 16 > pixelCount * 4 * 0.75) {
        alert('Widomosc za duza.');
        return;
    }

    // alert jezeli wiad za duza
    if (message.length > maxMessageSize) {
        alert('Widomosc za duza.');
        return;
    }

    // zakoduj wiadomosc
    var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    encodeMessage(imgData.data, sjcl.hash.sha256.hash(''), message);
    ctx.putImageData(imgData, 0, 0);


    alert('Zrobione!');

    output.src = canvas.toDataURL();

};


// enkoduje message do CanvasPixelArray 'colors'
var encodeMessage = function(colors, hash, message) {
    // wiadomosc -> tablica bitow
    var messageBits = getBitsFromNumber(message.length);
    messageBits = messageBits.concat(getMessageBits(message));

    // kolory ktore zmodyfikowalismy
    var history = [];

    // enkoduj bity w pixele
    var pos = 0;
    while (pos < messageBits.length) {
        // nastepna wartosc koloru ->nastepny bit
        var loc = getNextLocation(history, hash, colors.length);
        colors[loc] = setBit(colors[loc], 0, messageBits[pos]);

        // set the alpha value in this pixel to 255
        // we have to do this because browsers do premultiplied alpha
        // see for example: http://stackoverflow.com/q/4309364
        while ((loc + 1) % 4 !== 0) {
            loc++;
        }
        colors[loc] = 255;

        pos++;
    }
};

// zwraca lokacje do zapisu bitu
var getNextLocation = function(history, hash, total) {
    var pos = history.length;
    var loc = Math.abs(hash[pos % hash.length] * (pos + 1)) % total;
    while (true) {
        if (loc >= total) {
            loc = 0;
        } else if (history.indexOf(loc) >= 0) {
            loc++;
        } else if ((loc + 1) % 4 === 0) {
            loc++;
        } else {
            history.push(loc);
            return loc;
        }
    }
};
// zwraca tablice 0 i 1 dla message
var getMessageBits = function(message) {
    var messageBits = [];
    for (var i = 0; i < message.length; i++) {
        var code = message.charCodeAt(i);
        messageBits = messageBits.concat(getBitsFromNumber(code));
    }
    return messageBits;
};
// zwraca tablice 0 i 1 dla 2-bajtowej liczby
var getBitsFromNumber = function(number) {
   var bits = [];
   for (var i = 0; i < 16; i++) {
       bits.push(getBit(number, i));
   }
   return bits;
};

// zwraca 2-bajtowa liczbe dla tablicy 0 i 1
var getNumberFromBits = function(bytes, history, hash) {
    var number = 0, pos = 0;
    while (pos < 16) {
        var loc = getNextLocation(history, hash, bytes.length);
        var bit = getBit(bytes[loc], 0);
        number = setBit(number, pos, bit);
        pos++;
    }
    return number;
};
// zwraca wartosc bitu na okreslonej pozycji
var getBit = function(number, location) {
   return ((number >> location) & 1);
};

// ustawia bit w danej lokaccji
var setBit = function(number, location, bit) {
   return (number & ~(1 << location)) | (bit << location);
};

// dekoduj i wyswietl widomosc jezeli jakas jest
var decode = function() {



    var ctx = document.getElementById('canvas').getContext('2d');
    var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    var message = decodeMessage(imgData.data, sjcl.hash.sha256.hash(''));


    var obj = null;
    try {
        obj = JSON.parse(message);
    } catch (e) {
        
        document.getElementById('choose').style.display = 'block';
        document.getElementById('reveal').style.display = 'none';
    }
   
    if (obj) {
        document.getElementById('reveal').style.display = 'block';




        var escChars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#39;',
            '/': '&#x2F;',
            '\n': '<br/>'
        };
        var escHtml = function(string) {
            return String(string).replace(/[&<>"'\/\n]/g, function (c) {
                return escChars[c];
            });
        };
        document.getElementById('messageDecoded').innerHTML = escHtml(obj.text);
    }
};


var decodeMessage = function(colors, hash) {

    var history = [];


    var messageSize = getNumberFromBits(colors, history, hash);


    if ((messageSize + 1) * 16 > colors.length * 0.75) {
        return '';
    }


    if (messageSize === 0 || messageSize > maxMessageSize) {
        return '';
    }


    var message = [];
    for (var i = 0; i < messageSize; i++) {
        var code = getNumberFromBits(colors, history, hash);
        message.push(String.fromCharCode(code));
    }

    return message.join('');
};
