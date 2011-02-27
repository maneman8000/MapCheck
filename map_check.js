
if (MapCheckApl || mapCheckApl)
    throw "map_check.js already loaded";

// アプリケーションクラス定義
var MapCheckApl = Class.create();

MapCheckApl.prototype = {

    initialize : function() {
        // ここの初期値はHTMLのデフォルト値で上書きされる
        this.bounds_ = $A([0,0,0,0]);
        this.mat_ = $A([0,0]);
        this.imageDir_ = "images";
        var myOptions = {
            zoom: 12,  // 仮
            center: new google.maps.LatLng(0,0),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
//          mapTypeId: google.maps.MapTypeId.SATELLITE,
            scaleControl: true
        };
        this.mainmap_ = new google.maps.Map(
            document.getElementById("map_canvas"), myOptions);
        this.tileImages_ = null;
    },

    noOverlay : function() {
        return (this.mat_[0] == 0 || this.mat_[1] == 0
                || this.bounds_[0] - this.bounds_[2] == 0
                || this.bounds_[1] - this.bounds_[3] == 0);
    },

    overlayImages : function() {
        var res = $('inputLatLng1').fire('my:input');
        if (res.myError) {
            alert(res.myError);
            return;
        }
        res = $('inputMatRow1').fire('my:input');
        if (res.myError) {
            alert(res.myError);
            return;
        }
        res = $('inputMatCol1').fire('my:input');
        if (res.myError) {
            alert(res.myError);
            return;
        }
        $('inputInputDir1').fire('my:input');

        if (this.noOverlay()) return;
        if (this.tileImages_) this.tileImages_.clearOverlays();

        var bounds = new google.maps.LatLngBounds(
            // sw latlng
            new google.maps.LatLng(this.bounds_[2], this.bounds_[1]),
            // ne latlng
            new google.maps.LatLng(this.bounds_[0], this.bounds_[3]));

        this.tileImages_ = new this.TileImages(bounds, this.mat_, this.mainmap_);
        this.tileImages_.loadAndOverlayImages(this.imageDir_);

        // 最初のパン位置は全体の中心
        this.mainmap_.panTo(bounds.getCenter());
    },

    inputLatLng : function(event) {
        function isFloat(v) {
            return /^[\+\-]?[0-9]+(\.[0-9]+)?$/.test(v);
        };
        var v = event.element().value;
        var ll = $A(v.split(/, */));
        try {
            // check
            if (ll.length != 4) throw "不正な緯度経度の入力";
            ll.each(function(item) {
                        if (!isFloat(item)) throw "不正な緯度経度の入力"; });
            this.bounds_ = $A(ll);
        } catch (e) {
            event.myError = e;
            return 0;
        }
        return 1;
    },

    inputMatRow : function(event) {
        var v = event.element().value;
        try {
            if (!/^[0-9]+$/.test(v)) throw "不正な分割値の入力";
        } catch (e) {
            event.myError = e;
            return 0;
        }
        this.mat_[1] = v;
        return 1;
    },

    inputMatCol : function(event) {
        var v = event.element().value;
        try {
            if (!/^[0-9]+$/.test(v)) throw "不正な分割値の入力";
        } catch (e) {
            event.myError = e;
            return 0;
        }
        this.mat_[0] = v;
        return 1;
    },

    inputInputDir : function(event) {
        // TODO: 不正な入力のチェック(優先度は低い)
        // パスデリミタの正規化をして取り込む
        var v = event.element().value.replace(/\\/g, "/");
        // フルパスと思われるものは、"file://"をつける
        if (v.match(/^[a-z]\:/i)) v = "file://" + v;
        this.imageDir_ = v;
    }
};

// タイル画像管理クラス
MapCheckApl.prototype.TileImages = Class.create();

MapCheckApl.prototype.TileImages.prototype = {

    initialize : function(bounds, mat, mainmap) {
        this.divImages_ = null;
        this.overlays_ = null;
        this.bounds_ = bounds;
        this.mat_ = mat;
        this.mainmap_ = mainmap;
    },

    loadAndOverlayImages : function(root) {
        this.divImages_ = $A();
        var all = this.mat_[0]*this.mat_[1];
        for (var i = 0; i < all-1; ++i) {
            var img = new Image();
            img.src = this.getImageSrc(root, i);

            this.divImages_.push(img);
        }
        // 最後の画像の読み込みにonloadを入れる。
        // ただしこれがちゃんと一番最後に読み込みが終わるかは怪しい
        // それともそれぞれにonloadつけたほうがいいのか??
        // ただし、昔のコードではそれぞれにつけても1度しか呼ばれないなど
        // 問題があった。
        var img = new Image();
        this.divImages_.push(img);
        img.onload = this.onloadImages.bind(this);
        img.src = this.getImageSrc(root, all-1);
    },

    getImageSrc : function(root, i) {
        var fname = i.toString();
        // ゼロサプレス。もっといいやり方ありそう
        if (fname.length > 5) return fname + ".png";
        var h = "";
        $R(0, 5 - fname.length, true).each(function() {h += '0';});
        // フォルダ名とつなげる。もっといいやり方ありそう
        var r = root;
        if (root.charAt(root.length-1) != "/") r += "/";
        return r + h + fname + ".png";
    },

    onloadImages  : function() {
        try {
            // まずタイル画像の緯度経度テーブルを作る
            this.makeLatLngTable();

            // googleマップに貼り付け
            this.overlayImages();

        } catch (e) {
            alert(e);
            this.clearOverlays();
            return;
        }
    },

    inputImageSizes : function(num, s_func) {
        var out = $A();
        for (var i = 0; i < num; i++) {
            var v = s_func(i);
            if (!v) { throw "画像読み込みエラー!"; }
            out.push(v);
        }
        return out;
    },

    makeLatLngTable : function() {
        // 画像サイズ取得
        var horizontalSizes =
            this.inputImageSizes(this.mat_[0],
                                 function(i) { return this.divImages_[i].naturalWidth; }.bind(this));
        var verticalSizes =
            this.inputImageSizes(this.mat_[1],
                                 function(i) { return this.divImages_[i*this.mat_[0]].naturalHeight; }.bind(this));

        // サイズからタイル画像の緯度経度を求める
        var proj = this.mainmap_.getProjection();
        // 倍率を求める
        var ne = this.bounds_.getNorthEast();
        var sw = this.bounds_.getSouthWest();
        var ne_p = proj.fromLatLngToPoint(ne);
        var sw_p = proj.fromLatLngToPoint(sw);
        var mag_x = this.calcMag(horizontalSizes, ne_p.x - sw_p.x);
        var mag_y = this.calcMag(verticalSizes, sw_p.y - ne_p.y);
        // タイル画像の緯度経度をセットする
        this.tileLatLng_ = $A();
        var pos = [0,0];
        var spos = proj.fromLatLngToPoint(new google.maps.LatLng(ne.lat(), sw.lng()));
        for (var j = 0; j < this.mat_[1]; j++) {
            var size = null;
            for (var i = 0; i < this.mat_[0]; i++) {
                var img = this.divImages_[i + j*this.mat_[0]];
                size = [img.naturalWidth, img.naturalHeight];
                this.tileLatLng_
                    .push(new google.maps.LatLngBounds(
                              // sw latlng
                              proj.fromPointToLatLng(
                                  new google.maps.Point(
                                      spos.x + pos[0]*mag_x,
                                      spos.y + (pos[1]+size[1])*mag_y)),
                              // ne latlng
                              proj.fromPointToLatLng(
                                  new google.maps.Point(
                                      spos.x + (pos[0]+size[0])*mag_x,
                                      spos.y + pos[1]*mag_y))));
                pos[0] += size[0];
            }
            pos[0] = 0;
            pos[1] += size[1];
        }
    },

    overlayImages : function() {
        this.overlays_ = $A();
        for (var i = 0; i < this.tileLatLng_.length; i++) {
            this.overlays_.push(new this.MyOverlay(
                                    this.mainmap_,
                                    this.divImages_[i],
                                    this.tileLatLng_[i]));
        }
    },

    calcMag : function(sizes1, sz2) {
        var sz1 = 0;
        sizes1.each(function(item) { sz1 += item; });
        return sz2 / sz1;
    },

    clearOverlays : function() {
        if (this.overlays_ && this.overlays_.length > 0) {
            this.overlays_.each(function(item) { item.setMap(null); });
        }
        this.overlays_ = null;
        this.divImages_ = null;
        this.tileLatLng_ = null;
    }
};

// オーバーレイ用のクラス
// googleマップのサンプルを元に作っている
MapCheckApl.prototype.TileImages.prototype.MyOverlay = Class.create();

Object.extend(MapCheckApl.prototype.TileImages.prototype.MyOverlay.prototype,
              google.maps.OverlayView.prototype);

Object.extend(
    MapCheckApl.prototype.TileImages.prototype.MyOverlay.prototype, {
        // 先頭3つの引数は仮
        initialize : function(map, img, bounds) {
            this.img_ = img;
            this.bounds_ = bounds;
            this.setMap(map);
        },

        onAdd : function() {
            // Create the DIV and set some basic attributes.
            var div = document.createElement('DIV');
            div.style.borderStyle = "none";
            div.style.borderWidth = "0px";
            div.style.position = "absolute";

            // Create an IMG element and attach it to the DIV.
            var img = document.createElement("img");
            img.src = this.img_.src;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.MozOpacity = 0.4;
            div.appendChild(img);

            this.div_ = div;

            // We add an overlay to a map via one of the map's panes.
            // We'll add this overlay to the overlayImage pane.
            var panes = this.getPanes();
            panes.overlayImage.appendChild(div);
        },

        draw : function() {

            // Size and position the overlay. We use a southwest and northeast
            // position of the overlay to peg it to the correct position and size.
            // We need to retrieve the projection from this overlay to do this.
            var overlayProjection = this.getProjection();

            var bounds = this.bounds_;

            var sw, ne;
            var div = this.div_;

            // Retrieve the southwest and northeast coordinates of this overlay
            // in latlngs and convert them to pixels coordinates.
            // We'll use these coordinates to resize the DIV.
            sw = overlayProjection.fromLatLngToDivPixel(bounds.getSouthWest());
            ne = overlayProjection.fromLatLngToDivPixel(bounds.getNorthEast());

            // Resize the image's DIV to fit the indicated dimensions.
            div.style.left = sw.x + 'px';
            div.style.top = ne.y + 'px';
            div.style.width = (ne.x - sw.x) + 'px';
            div.style.height = (sw.y - ne.y) + 'px';

        },

        onRemove : function() {
            this.div_.parentNode.removeChild(this.div_);
            this.div_ = null;
        }

    });

MapCheckApl.prototype.MapControl = Class.create();

MapCheckApl.prototype.MapControl.prototype = {

    initialize : function() {
        
    },
};

var mapCheckApl = null;

function onLoadBody() {
    mapCheckApl = new MapCheckApl;
    $('buttonOverlay1').observe('click', mapCheckApl.overlayImages.bind(mapCheckApl));

    $('inputLatLng1').observe('my:input', mapCheckApl.inputLatLng.bind(mapCheckApl));
    $('inputMatRow1').observe('my:input', mapCheckApl.inputMatRow.bind(mapCheckApl));
    $('inputMatCol1').observe('my:input', mapCheckApl.inputMatCol.bind(mapCheckApl));
    $('inputInputDir1').observe('my:input', mapCheckApl.inputInputDir.bind(mapCheckApl));
    // HTMLに書いたデフォルト値を反映させるため
    $('inputLatLng1').fire('my:input');
    $('inputMatRow1').fire('my:input');
    $('inputMatCol1').fire('my:input');
    $('inputInputDir1').fire('my:input');
}
