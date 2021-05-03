/*!
 * Copyright (C) 2021,
 * - Kazuyuki TAKASE (https://github.com/Guvalif)
 * 
 * This software is released under the MIT License.
 * See also: http://opensource.org/licenses/mit-license.php
 */

'use strict';

var keyEventHandler = null;
var updateEventHandler = null;

const Application = {
  data() {
    return {
      bookmarkBarId: '',
      bookmarkBar: [],
      bookmarkBarScroll: 0,
      otherBookmarksId: '',
      otherBookmarks: [],
      otherBookmarksScroll: 0,
      currentPain: 'bookmarkBar',
      current: 0,
    };
  },

  mounted() {
    chrome.bookmarks.getTree(result => {
      this.bookmarkBarId = result[0].children[0].id;
      this.bookmarkBar = result[0].children[0].children;

      this.otherBookmarksId = result[0].children[1].id;
      this.otherBookmarks = result[0].children[1].children;
    });

    keyEventHandler = this.keyEventHandler.bind(this);
    window.addEventListener('keydown', keyEventHandler);
  },

  methods: {
    prettify(tree) {
      return tree.map(node => node.children ? `📁 ${node.title}` : node.title);
    },

    isFocused(pain, index) {
      return (pain === this.currentPain) && (index === this.current);
    },

    keyEventHandler(event) {
      switch (event.key) {
        case 'F5': {
          location.reload();

          break;
        }

        case 'ArrowUp': {
          const next = Math.max(0, this.current - 1);
          this.current = next;

          this.setScrollPosition(next === 0);

          break;
        }

        case 'ArrowDown': {
          const next = Math.min(this.current + 1, this[this.currentPain].length - 1);
          this.current = next;

          this.setScrollPosition();

          break;
        }

        case 'ArrowLeft': {
          if (this.currentPain !== 'bookmarkBar') {
            this.currentPain = 'bookmarkBar';
            this.current = 0;

            this.setScrollPosition(true);
          } else {
            this.keyEventHandler({ key: 'Backspace' });
          }

          break;
        }

        case 'ArrowRight': {
          if (this.currentPain !== 'otherBookmarks') {
            this.currentPain = 'otherBookmarks';
            this.current = 0;

            this.setScrollPosition(true);
          } else {
            this.keyEventHandler({ key: 'Backspace' });
          }

          break;
        }

        case 'Home': {
          this.current = 0;

          this.setScrollPosition(true);

          break;
        }

        case 'End': {
          if (this[this.currentPain].length) {
            this.current = this[this.currentPain].length - 1;

            this.setScrollPosition(this.current === 0);
          }

          break;
        }

        case 'k': {
          const index = this[this.currentPain].length ? this.current + 1 : 0;

          chrome.bookmarks.create({
            index,
            parentId: this[`${this.currentPain}Id`],
            title: '新しいフォルダ',
          }, result => {
            result.children = [];
            this[this.currentPain].splice(index, 0, result);
            this.current = index;
          });

          break;
        }

        case 'r': {
          const ref = this[this.currentPain][this.current];

          if (ref) {
            this.$refs.$selected.value = ref.title;

            setTimeout(() => {
              window.removeEventListener('keydown', keyEventHandler);
              keyEventHandler = null;

              updateEventHandler = this.updateEventHandler.bind(this);
              window.addEventListener('keydown', updateEventHandler);

              this.$refs.$selected.focus();
            }, 0);
          }

          break;
        }

        case 'd': {
          const ref = this[this.currentPain][this.current];

          if (ref && confirm(`Are you sure you want to delete "${ref.title}"?`)) {
            this[this.currentPain] = this[this.currentPain].filter(x => x.id !== ref.id);
            this.current = Math.max(0, this.current - 1);

            chrome.bookmarks.removeTree(ref.id);
          }

          break;
        }

        case 'm': {
          const ref = this[this.currentPain][this.current];

          if (ref) {
            const oppositePain = (this.currentPain === 'bookmarkBar') ? 'otherBookmarks' : 'bookmarkBar';

            this[this.currentPain] = this[this.currentPain].filter(x => x.id !== ref.id);
            this[oppositePain].splice(0, 0, ref);

            this.currentPain = oppositePain;
            this.current = 0;

            this.setScrollPosition(true);

            chrome.bookmarks.move(ref.id, { parentId: this[`${oppositePain}Id`], index: 0 });
          }

          break;
        }

        case 'Enter': {
          const ref = this[this.currentPain][this.current];

          if (ref.url) {
            window.open(ref.url, '_blank');
          } else {
            this.current = 0;
            this[`${this.currentPain}Id`] = ref.id;
            this[this.currentPain] = ref.children;

            this.setScrollPosition(true);
          }

          break;
        }

        case 'Backspace': {
          const refId = this[`${this.currentPain}Id`];

          chrome.bookmarks.get(refId, parent => {
            if (parent[0].parentId === '0') return;

            chrome.bookmarks.getSubTree(parent[0].parentId, result => {
              this.current = result[0].children.findIndex(node => node.id === refId);
              this[`${this.currentPain}Id`] = result[0].id;
              this[this.currentPain] = result[0].children;

              this.setScrollPosition(this.current === 0);
            });
          });

          break;
        }
      }

      event.preventDefault();
    },

    updateEventHandler(event) {
      const $element = this.$refs.$selected;

      if (event.key === 'Enter' && event.ctrlKey) {
        $element.blur();

        const ref = this[this.currentPain][this.current];

        ref.title = $element.value;
        this[this.currentPain].splice(this.current, 1, ref);

        chrome.bookmarks.update(ref.id, { title: $element.value });

        setTimeout(() => {
          window.removeEventListener('keydown', updateEventHandler);
          updateEventHandler = null;

          keyEventHandler = this.keyEventHandler.bind(this);
          window.addEventListener('keydown', keyEventHandler);
        }, 0);
      }
    },

    setScrollPosition(forceScrollToTop) {
      setTimeout(() => {
        const $element = this.$refs.$selected;
        const $pain = document.getElementById((this.currentPain === 'bookmarkBar') ? 'bookmark-bar-items' : 'other-bookmarks-items');

        if ($element) {
          if (forceScrollToTop) {
            this[`${this.currentPain}Scroll`] = 0;
            $pain.style.marginTop = '0px';

            return;
          }

          const top = $element.getBoundingClientRect().top;
          const bottom = $element.getBoundingClientRect().bottom;

          if (top < 32) {
            this[`${this.currentPain}Scroll`] += (32 - top);
            $pain.style.marginTop = `${this[`${this.currentPain}Scroll`]}px`;
          }

          if (bottom > window.innerHeight) {
            this[`${this.currentPain}Scroll`] -= (bottom - window.innerHeight);
            $pain.style.marginTop = `${this[`${this.currentPain}Scroll`]}px`;
          }
        }
      }, 0);
    },
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Vue.createApp(Application).mount('#application');
});
