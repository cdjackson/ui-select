angular.module('ui.select.tagging', ['ui.select'])
    .directive('uiSelectTagging',
    ['$parse', '$timeout', function () {
        return {
            require: '^uiSelect',
            link: function (scope, element, attrs, $select) {
                var ctrl = $select;
                ctrl.taggingLabel = attrs.taggingLabel !== undefined ? attrs.taggingLabel : false;
                ctrl.taggingTokens =
                    attrs.taggingTokens !== undefined ? attrs.taggingTokens.split('|') : [',', 'ENTER'];

                // If tagging try to split by tokens and add items
                ctrl.searchInput.on('paste', function (e) {
                    var data = e.clipboardData.getData('text/plain');
                    if (data && data.length > 0) {
                        var items = data.split(ctrl.taggingTokens[0]); // Split by first token only
                        if (items && items.length > 0) {
                            angular.forEach(items, function (item) {
                                var newItem = ctrl.beforeTagging(item);
                                if (newItem) {
                                    ctrl.select(newItem, true);
                                }
                            });
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                });

                // Define the default callback into the controller
                ctrl.beforeTagging = function (item) {
                    return item;
                };


                // Override the keypress callback
                ctrl.afterKeypress = function (e) {


//                    if ( ! ctrl.KEY.isVerticalMovement(e.which) ) {
//                        scope.$evalAsync( function () {
//                            $select.activeIndex = $select.taggingLabel === false ? -1 : 0;
//                        });
//                    }

                    // Push a "create new" item into array if there is a search string
                    if ($select.search.length > 0) {
                        // Return early with these keys
                        if (e.which === ctrl.KEY.TAB || ctrl.KEY.isControl(e) || ctrl.KEY.isFunctionKey(e) ||
                            e.which === ctrl.KEY.ESC ||
                            ctrl.KEY.isVerticalMovement(e.which)) {
                            return;
                        }

                        // Check for end of tagging
                        var tagged = false;
//                        if (e.which === ctrl.KEY.ENTER) {
//                            tagged = true;
//                        }
                        for (var i = 0; i < ctrl.taggingTokens.length; i++) {
                            if (ctrl.taggingTokens[i] === ctrl.KEY.MAP[e.keyCode]) {
                                // Make sure there is a new value to push via tagging
                                if (ctrl.search.length > 0) {
                                    tagged = true;
                                    if ($select.search.substr($select.search.length - 1) == ctrl.KEY.MAP[e.keyCode]) {

                                    $select.search = $select.search.substr(0, $select.search.length - 1);
                                }
                                }
                            }
                        }
                        if (tagged === true) {
                            ctrl.select(ctrl.beforeTagging($select.search));
                            return;
                        }


                        $select.activeIndex = $select.taggingLabel === false ? -1 : 0;
                        // If taggingLabel === false bypasses all of this
                        if ($select.taggingLabel === false) {
                            return;
                        }

                        var items = angular.copy($select.items);
                        var stashArr = angular.copy($select.items);
                        var newItem;
                        var item;
                        var hasTag = false;
                        var dupeIndex = -1;
                        var tagItems;
                        var tagItem;


                        // Find any tagging items already in the $select.items array and store them
                        tagItems = $select.$filter('filter')(items, function (item) {
                            return item.match($select.taggingLabel);
                        });
                        if (tagItems.length > 0) {
                            tagItem = tagItems[0];
                        }
                        item = items[0];
                        // Remove existing tag item if found (should only ever be one tag item)
                        if (item !== undefined && items.length > 0 && tagItem) {
                            hasTag = true;
                            items = items.slice(1, items.length);
                            stashArr = stashArr.slice(1, stashArr.length);
                        }
                        newItem = $select.search + ' ' + $select.taggingLabel;
                        if (_findApproxDupe($select.selected, $select.search) > -1) {
                            return;
                        }
                        // Verify the the tag doesn't match the value of an existing item from
                        // the searched data set or the items already selected
                        if (_findCaseInsensitiveDupe(stashArr.concat($select.selected))) {
                            // if there is a tag from prev iteration, strip it / queue the change
                            // and return early
                            if (hasTag) {
                                items = stashArr;
                                scope.$evalAsync(function () {
                                    $select.activeIndex = 0;
                                    $select.items = items;
                                });
                            }
                            return;
                        }
                        if (_findCaseInsensitiveDupe(stashArr)) {
                            // If there is a tag from prev iteration, strip it
                            if (hasTag) {
                                $select.items = stashArr.slice(1, stashArr.length);
                            }
                            return;
                        }
//                        }
                        if (hasTag) {
                            dupeIndex = _findApproxDupe($select.selected, newItem);
                        }
                        // dupe found, shave the first item
                        if (dupeIndex > -1) {
                            items = items.slice(dupeIndex + 1, items.length - 1);
                        } else {
                            items = [];
                            items.push(newItem);
                            items = items.concat(stashArr);
                        }
                        scope.$evalAsync(function () {
                            $select.activeIndex = 0;
                            $select.items = items;
                        });
                    }
                };


                function _findCaseInsensitiveDupe(arr) {
                    if (arr === undefined || $select.search === undefined) {
                        return false;
                    }
                    var hasDupe = arr.filter(function (origItem) {
                            if ($select.search.toUpperCase() === undefined || origItem === undefined) {
                                return false;
                            }
                            return origItem.toUpperCase() === $select.search.toUpperCase();
                        }).length > 0;

                    return hasDupe;
                }

                function _findApproxDupe(haystack, needle) {
                    var dupeIndex = -1;
                    if (angular.isArray(haystack)) {
                        var tempArr = angular.copy(haystack);
                        for (var i = 0; i < tempArr.length; i++) {
                            // handle the simple string version of tagging
//                            if ($select.tagging.fct === undefined) {
                            // search the array for the match
                            if (tempArr[i] + ' ' + $select.taggingLabel === needle) {
                                dupeIndex = i;
                            }
                            // handle the object tagging implementation
                            /*                            } else {
                             var mockObj = tempArr[i];
                             mockObj.isTag = true;
                             if (angular.equals(mockObj, needle)) {
                             dupeIndex = i;
                             }
                             }*/
                        }
                    }
                    return dupeIndex;
                }


            }
        };
    }]);
