// NOTE! This code uses pipe() and not then() to pipe Deferreds, as the host page is jQuery 1.6.4
// (i.e. less than 1.8, when then() becomes replacement for pipe()).

/*jslint browser: true*/
/*global jQuery, console*/
define([

"module",

"./deferred-utils", "./console", "./ajax",

"./adventures-model", "./units-required-model", "./units-required", "./adventures-page", "./thesettlersonline-wiki"

], function(module, deferredUtils, _console, ajax, adventuresModel, unitsRequiredModel, unitsRequired, adventuresPage, wiki) {
    var $ = jQuery;
    if ("1.6.4" !== jQuery.fn.jquery) {
        throw new Error("Expected jQuery 1.6.4!");
    }

    var DEBUG = false;
    var log = _console.createLog(module.id, DEBUG);

    var AdventuresPage = adventuresPage.AdventuresPage;
    var UnitList = unitsRequiredModel.UnitList;
    var AdventuresModel = adventuresModel;

    function get(url) {
        return ajax.ajax(url);
    }





    // UI class for an Adventure Box
    // All the UI handling for the enhancements to each adventure <li>

    function AdventureBox(li, adventureInfo) {
        this.li = li;
        this.adventureInfo = adventureInfo;
    }

    AdventureBox.prototype.showResults = function(details) {
        var li = $(this.li);
        if (details.attackPlan) {
            // Guess at the max xp2/tuv ratio
            var MAX_XP_TUV_RATIO = 40;
            var info = handleDetails(li, details);
            var ratioStr = toNdp("" + (info.xp2 / info.tuv), 2);
            var arr = [info.totalLosses, info.xp2, info.tuv, ratioStr];
            var bar = createBar(100, 100 * (info.xp2 / info.tuv) / MAX_XP_TUV_RATIO);
            var ratioStrEl = $("<div>").css({
                "display": "inline-block",
                "width": "100%",
                "text-align": "center"
            }).append(ratioStr);
            var ratioEl = $("<div>").css("display", "inline-block").append(bar).append("<br>").append(ratioStrEl);
            var lossesEl = $("<div>").attr("style", "padding: 2px;").append(info.totalLosses.toHtmlString()).append("Total Losses: " + info.tuv);
            li.find(".wiki-link").before(lossesEl);
            li.find(".camp-ep").append(ratioEl);
            log([info.title].concat(arr).join("\t"));
            return info;
        }
        return null;
    };

    AdventureBox.prototype.addWikiLink = function(title) {
        var link = $("<a>").addClass("wiki-link btn-link").attr("href", wiki.getLink(title)).html("wiki");
        this.li.append(link);
        return link;
    };

    AdventureBox.prototype.addUnitsRequiredLink = function() {
        var link = $("<a>").addClass("units-required-link btn-link").attr("href", "#").html("Units Required");
        this.li.append("&nbsp;").append(link);
        return link;
    };

    AdventureBox.prototype.addAllUnitsRequiredLink = function() {
        var link = $("<a>").addClass("all-units-required-link btn-link").attr("href", "#").html("*");
        this.li.append("&nbsp;").append(link);
        return link;
    };

    AdventureBox.loadAttackPlan = function(adventureInfo) {
        var xhr = get(adventureInfo.href);
        xhr.href = adventureInfo.href;
        xhr.idx = adventureInfo.idx;
        return xhr.pipe(mapHtmlToAttackPlan.bind(null, adventureInfo.idx));
    };

    AdventureBox.prototype.updateWithAttackPlan = function(status, details) {
        var li = this.li;
        var info = this.adventureInfo;
        var link = li.find(".units-required-link").first();
        details.title = AdventuresPage.liTitle(li);
        var box = new AdventureBox(li);
        var results = box.showResults(details);
        if (results) {
            // Mixin the new data.
            $.extend(info, results);
            link.remove();
        }
    };

    AdventureBox.updateAllAttackPlans = function(adventureBoxes, progressCallback) {
        var count = 0;
        var size = adventureBoxes.length;
        var dfds = adventureBoxes.map(function(box) {
            return AdventureBox.loadAttackPlan(box.adventureInfo).then(function(status, details) {
                progressCallback({
                    item: ++count,
                    size: size
                });
                box.updateWithAttackPlan(status, details);
            });
        });
        return $.when.apply($, dfds);
    };

    AdventureBox.onAllUnitsRequiredClicked = function(adventureBoxes, progressCallback, evt) {
        evt.preventDefault();
        evt.stopPropagation();
        AdventureBox.updateAllAttackPlans(adventureBoxes, progressCallback);
    };

    AdventureBox.onUnitsRequiredClicked = function(adventureBoxes, evt) {
        evt.preventDefault();
        evt.stopPropagation();

        var link = $(evt.target);
        var li = link.closest("li");
        var i = AdventuresPage.idx(li);

        // Find the adventure info object with matching index.
        // Should only be one, hence the [0].
        var box = adventureBoxes.filter(function(box) {
            return box.adventureInfo.idx === i;
        })[0];

        AdventureBox.loadAttackPlan(box.adventureInfo).then(box.updateWithAttackPlan.bind(box));
    };

    AdventureBox.prototype.addRewardsLink = function() {
        var link = $("<a>").addClass("rewards-link btn-link").attr("href", "#").html("Rewards");
        this.li.append("&nbsp;").append(link);
        return link;
    };

    AdventureBox.onRewardsClicked = function(adventureInfoList, evt) {
        evt.preventDefault();
        evt.stopPropagation();

        var link = $(evt.target);
        var li = link.closest("li");
        var title = AdventuresPage.liTitle(li);

        var rewards = li.find(".rewards").first();
        if (rewards.length < 1) {
            wiki.getRewardsImageSrc(title).then(function(src) {
                var img = $("<img>").attr("src", src);
                var p = $("<p>").addClass("rewards");
                p.append(img);
                li.find("p").first().after(p);
            });
        } else {
            rewards.toggle();
        }
    };





    /**
     * Remove the JS that tries to ensure the page is the top frame/window.
     */
    function preventNavigation(html) {
        var len = html.length;
        html = html.replace("if(top != self){top.location = self.location}", "");
        if (html.length === len) {
            log("Did not find 'top.location = self.location' code.");
        }
        return html;
    }

    function getAdventureDetails(html) {
        try {
            var attackPlan = unitsRequired.getUnitsRequiredFromAdventurePageHtml(html);
            var title = "FAKE"; //$doc.find("title").text().trim();
            return {
                attackPlan: attackPlan,
                title: title
            };
        } catch (e) {
            return {
                error: e
            };
        }
    }

    /**
     * Processes the adventure page by returning a Deferred that is resolved with the adventure's
     * details.
     */
    function handleAdventure(idx, html) {
        log("handleAdventure.enter", arguments);

        var dfd = $.Deferred();

        var details = getAdventureDetails(html);
        dfd.resolve(details);

        log("handleAdventure.exit");

        return dfd.promise();
    }

    function toNdp(s, n) {
        var i = s.indexOf(".");
        if (i < 0) {
            return s;
        }
        return s.substring(0, i + n + 1);
    }

    function mapHtmlToAttackPlan(idx, html, status, xhr) {
        log("processXhr", arguments);
        if ("success" === status) {
            return handleAdventure(idx, html).pipe(function(details) {
                log("processXhr.success", arguments);
                return deferredUtils.resolveWith(status, details).promise();
            });
        }
        return deferredUtils.rejectWith("xhr error", xhr).promise();
    }

    function handleDetails(li, details) {
        var xp = AdventuresPage.liXp(li);
        var title = AdventuresPage.liTitle(li);
        var totalLosses = details.attackPlan.getTotalLosses();
        var tuv = totalLosses.totalUnitValue();
        // XP as calculated is called xp2. xp remains as recorded from the adventures page.
        return {
            totalLosses: totalLosses,
            title: title,
            xp2: xp,
            tuv: tuv
        };
    }

    // Creates a bar chart effect
    function createBar(w1, w2) {
        w1 = ("string" === typeof w1) ? w1 : w1 + "px";
        w2 = ("string" === typeof w2) ? w2 : w2 + "px";
        var outer = $("<div>").css({
            "width": w1
        }).addClass("bar-outer");
        var inner = $("<div>").css({
            "width": w2
        }).addClass("bar-inner");
        return outer.append(inner.append("&nbsp;"));
    }

    function reorderLis(ul, lis) {
        lis.forEach(function(li) {
            li.remove();
        });
        lis.forEach(function(li) {
            ul.append(li);
        });
    }

    function whenAllAdventuresProcessed(ads, adventureBoxes, adventureInfoList) {
        var UP_ARROW = "\u25B2";
        var DOWN_ARROW = "\u25BC";
        var arrowSpans = null;
        var clone = adventureBoxes.slice();

        function createButtonBar(btns) {
            var div = $("<div>").html("[ ");
            for (var i = 0; i < btns.length; i++) {
                if (i > 0) {
                    div.append(" | ");
                }
                div.append(btns[i]);
            }
            div.append(" ]");

            var style = div[0].style;
            style.padding = "2px";
            style.borderTop = "solid 2px green";
            style.borderBottom = "solid 2px green";

            return div;
        }

        function createSortBtnHandler(sortInfoFn) {
            return function(evt) {
                // this === anchor
                evt.preventDefault();
                var reverseSort = !! this.reverseSort;

                AdventuresModel.sortInfo(adventureInfoList, reverseSort, sortInfoFn);

                for (var i = 0; i < adventureInfoList.length; i++) {
                    adventureBoxes[i] = clone[adventureInfoList[i].idx];
                }

                var lis = adventureBoxes.map(function(box) {
                    return box.li;
                });
                reorderLis(ads, lis);
                this.reverseSort = !reverseSort;
                // Clear the arrows from all sort links
                arrowSpans.empty();
                $(this).find("span").html(reverseSort ? UP_ARROW : DOWN_ARROW);
            };
        }

        function createSortLink(text, sortInfoFn) {
            // for the arrow
            var span = $("<span>");
            return $("<a>").attr("href", "#").html(text).append(span).click(createSortBtnHandler(sortInfoFn))[0];
        }

        var sortByRatio = createSortLink("Sort by ratio", AdventuresModel.sortInfoByRatio);
        var sortByXp = createSortLink("Sort by XP", AdventuresModel.sortInfoByXP);
        var sortByTotalLosses = createSortLink("Sort by total losses", AdventuresModel.sortInfoByTotalLosses);
        var btns = [sortByRatio, sortByXp, sortByTotalLosses];

        arrowSpans = $(btns).find("span");

        ads.prepend(createButtonBar(btns));
    }

    function addStyles(cssStr) {
        if (cssStr.join) {
            cssStr = cssStr.join("\n");
        }
        $("<style>").text(cssStr).appendTo(document.body);
    }

    function execute() {
        var css = [];
        css.push("a.btn-link { font-family: Tahoma; background: green; color: white; border-radius: 6px; padding: 2px; padding-left: 4px; padding-right: 4px; }");
        css.push(".bar-outer { display: inline-block; background: white; border: solid 1px black; }");
        css.push(".bar-inner { display: inline-block; background: green; }");
        addStyles(css);

        var adventureInfoList = [];
        // GLOBAL!
        window["adventureInfoList"] = adventureInfoList;

        var allDfds = [];

        var page = new AdventuresPage(document);
        var ads = page.findAdventuresElement();

        // For each adventure, load the adventure page, and process it.
        var lis = page.findAdventureLis().toArray();
        var adventureBoxes = lis.map(function(li, i) {
            li = $(li);

            AdventuresPage.idx(li, i);
            var xp = AdventuresPage.liXp(li);
            xp = AdventuresPage.xp(li, xp);
            li[0].style.border = "solid lightgray 1px";

            var href = AdventuresPage.liAdventureHref(li);

            var adventureInfo = {
                idx: i,
                href: href,
                xp: xp
            };

            var adventureBox = new AdventureBox(li, adventureInfo);
            adventureBox.addWikiLink(AdventuresPage.liTitle(li));
            var unitsRequiredLink = adventureBox.addUnitsRequiredLink();
            var allUnitsRequiredLink = adventureBox.addAllUnitsRequiredLink();
            var rewardsLink = adventureBox.addRewardsLink(href);

            //log(i, href);

            // Sparsely populate the adventure info with the basics.
            // If we click the adventure info link then we will add more details.
            adventureInfoList.push(adventureInfo);

            return adventureBox;
        });

        // A callback that is fired for each adventure that is loaded, when we're finding out the units required
        var allUnitsRequiredProgressCallback = (function() {
            var bar = createBar("100%", "0%");
            var inner = bar.find("div").first();

            return function(info) {
                $(ads).prepend(bar);
                var msg = info.item + " of " + info.size;
                inner.css("width", (info.item / info.size) * 100 + "%");
            };
        }());

        // jQuery 1.6.4 does not have 'on'.
        ads.delegate(".all-units-required-link", "click", AdventureBox.onAllUnitsRequiredClicked.bind(null, adventureBoxes, allUnitsRequiredProgressCallback));
        ads.delegate(".units-required-link", "click", AdventureBox.onUnitsRequiredClicked.bind(null, adventureBoxes));
        ads.delegate(".rewards-link", "click", AdventureBox.onRewardsClicked.bind(null, adventureBoxes));

        whenAllAdventuresProcessed(ads, adventureBoxes, adventureInfoList);
    }

    return {
        execute: execute
    };
});