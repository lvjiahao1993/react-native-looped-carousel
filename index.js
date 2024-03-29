import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewPropTypes,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import PropTypes from 'prop-types';
import isEqual from 'lodash.isequal';
const PAGE_CHANGE_DELAY = 4000;

// if ViewPropTypes is not defined fall back to View.propTypes (to support RN < 0.44)
const viewPropTypes = ViewPropTypes || View.propTypes;

/**
 * Animates pages in cycle
 * (loop possible if children count > 1)
 */
export default class Carousel extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    autoplay: PropTypes.bool,
    delay: PropTypes.number,
    currentPage: PropTypes.number,
    style: viewPropTypes.style,
    pageStyle: viewPropTypes.style,
    contentContainerStyle: viewPropTypes.style,
    showIndicator: PropTypes.bool,
    indicatorCircleHeight: PropTypes.number,
    indicatorCircleWidth: PropTypes.number,
    indicatorDefaultColor: PropTypes.string,
    indicatorActiveColor: PropTypes.string,
    indicatorBottomContainerStyle: viewPropTypes.style,
    indicatorOpacity: PropTypes.number,
    bullets: PropTypes.bool,
    bulletsContainerStyle: Text.propTypes.style,
    bulletStyle: Text.propTypes.style,
    arrows: PropTypes.bool,
    arrowsContainerStyle: Text.propTypes.style,
    arrowStyle: Text.propTypes.style,
    leftArrowStyle: Text.propTypes.style,
    rightArrowStyle: Text.propTypes.style,
    leftArrowText: PropTypes.string,
    rightArrowText: PropTypes.string,
    chosenBulletStyle: Text.propTypes.style,
    onAnimateNextPage: PropTypes.func,
    swipe: PropTypes.bool,
    isLooped: PropTypes.bool,
  };

  static defaultProps = {
    delay: PAGE_CHANGE_DELAY,
    autoplay: true,
    showIndicator: false,
    bullets: false,
    arrows: false,
    indicatorDefaultColor: 'rgba(0, 0, 0, 0.25)',
    indicatorActiveColor: '#FFF',
    indicatorCircleHeight: 5,
    indicatorOpacity: 1,
    currentPage: 0,
    style: undefined,
    pageStyle: undefined,
    contentContainerStyle: undefined,
    indicatorTextStyle: undefined,
    indicatorBottomContainerStyle: undefined,
    bulletsContainerStyle: undefined,
    chosenBulletStyle: undefined,
    bulletStyle: undefined,
    arrowsContainerStyle: undefined,
    arrowStyle: undefined,
    leftArrowStyle: undefined,
    rightArrowStyle: undefined,
    leftArrowText: '',
    rightArrowText: '',
    onAnimateNextPage: undefined,
    swipe: true,
    isLooped: true,
  };

  constructor(props) {
    super(props);
    const size = { width: 0, height: 0 };
    if (props.children) {
      const childrenLength = React.Children.count(props.children) || 1;
      this.state = {
        currentPage: props.currentPage,
        size,
        childrenLength,
        contents: null,
      };
    } else {
      this.state = { size };
    }
    this.progress = new Animated.Value(0);
  }

  componentDidMount() {
    if (this.state.childrenLength) {
      this._setUpTimer();
      this.startAnimation();
    }

    // Set up pages but not content. Content will be set up via onLayout event.
    this._setUpPages().then(() => this.setState({ contents: this.pages }));
  }

  componentDidUpdate(prevProps, prevState) {
    const { currentPage } = this.state;
    if (prevState.currentPage !== currentPage) {
      this.startAnimation();
    }
  }
  startAnimation = () => {
    const { indicatorCircleHeight, indicatorCircleWidth } = this.props;
    this.progress.setValue(0);
    Animated.timing(this.progress, {
      toValue: indicatorCircleWidth
        ? indicatorCircleWidth
        : indicatorCircleHeight * 12,
      duration: 3000,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  };

  componentWillUnmount() {
    this._clearTimer();
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.children, nextProps.children)) {
      let childrenLength = 0;
      if (nextProps.children) {
        const length = React.Children.count(nextProps.children);
        childrenLength = length || 1;
      }
      if (this.state.currentPage >= childrenLength) {
        this._setCurrentPage(0);
      }
      this.setState({ childrenLength }, () => {
        this._setUpPages().then(() => this.setState({ contents: this.pages }));
      });
      this._setUpTimer();
    }
  }

  _setUpPages() {
    return new Promise((resolve) => {
      const { size } = this.state;
      const children = React.Children.toArray(this.props.children);
      const pages = [];

      if (children && children.length > 1) {
        // add all pages
        for (let i = 0; i < children.length; i += 1) {
          pages.push(children[i]);
        }
        // We want to make infinite pages structure like this: 1-2-3-1-2
        // so we add first and second page again to the end
        if (this.props.isLooped) {
          pages.push(children[0]);
          pages.push(children[1]);
        }
      } else if (children) {
        pages.push(children[0]);
      } else {
        pages.push(
          <View>
            <Text>You are supposed to add children inside Carousel</Text>
          </View>
        );
      }
      this.pages = pages.map((page, i) => (
        <TouchableWithoutFeedback
          style={[{ ...size }, this.props.pageStyle]}
          key={`page${i}`}
        >
          {page}
        </TouchableWithoutFeedback>
      ));
      resolve();
    });
  }

  getCurrentPage() {
    return this.state.currentPage;
  }

  _onScrollBegin = () => {
    this._clearTimer();
  };

  _setCurrentPage = (currentPage) => {
    this.setState({ currentPage }, () => {
      if (this.props.onAnimateNextPage) {
        // FIXME: called twice on ios with auto-scroll
        this.props.onAnimateNextPage(currentPage);
      }
    });
  };

  _onScrollEnd = (event) => {
    const offset = { ...event.nativeEvent.contentOffset };
    const page = this._calculateCurrentPage(offset.x);
    this._placeCritical(page);
    this._setCurrentPage(page);
    this._setUpTimer();
  };

  _onLayout = (event) => {
    const { height, width } = event.nativeEvent.layout;
    this.setState({ size: { width, height } });
    // remove setTimeout wrapper when https://github.com/facebook/react-native/issues/6849 is resolved.
    setTimeout(() => this._placeCritical(this.state.currentPage), 0);
  };

  _clearTimer = () => {
    this.timer && clearTimeout(this.timer);
  };

  _setUpTimer = () => {
    // only for cycling
    if (this.props.autoplay && React.Children.count(this.props.children) > 1) {
      this._clearTimer();
      this.timer = setTimeout(this._animateNextPage, this.props.delay);
    }
  };

  _scrollTo = ({ offset, animated, nofix }) => {
    if (this.scrollView) {
      this.scrollView.scrollTo({ y: 0, x: offset, animated });

      // Fix bug #50
      if (!nofix && Platform.OS === 'android' && !animated) {
        this.scrollView.scrollTo({ y: 0, x: offset, animated: true });
      }
    }
  };

  _animateNextPage = () => {
    const { currentPage } = this.state;
    const nextPage = this._normalizePageNumber(currentPage + 1);

    // prevent from looping
    if (!this.props.isLooped && nextPage < currentPage) {
      return;
    }
    this.animateToPage(nextPage);
  };

  _animatePreviousPage = () => {
    const { currentPage } = this.state;
    const nextPage = this._normalizePageNumber(currentPage - 1);

    // prevent from looping
    if (!this.props.isLooped && nextPage > currentPage) {
      return;
    }
    this.animateToPage(nextPage);
  };

  animateToPage = (page) => {
    let currentPage = page;
    this._clearTimer();
    const {
      childrenLength,
      size: { width },
    } = this.state;
    if (currentPage >= childrenLength) {
      currentPage = this.props.isLooped ? 0 : childrenLength - 1;
    }
    if (currentPage === 0) {
      // animate properly based on direction
      const scrollMultiplier =
        this.state.currentPage === 1 && childrenLength !== 2 ? 1 : -1;
      this._scrollTo({
        offset: (childrenLength + 1 * scrollMultiplier) * width,
        animated: false,
        nofix: true,
      });
      this._scrollTo({ offset: childrenLength * width, animated: true });
    } else if (currentPage === 1) {
      const scrollMultiplier = this.state.currentPage === 0 ? 0 : 2;
      this._scrollTo({
        offset: width * scrollMultiplier,
        animated: false,
        nofix: true,
      });
      this._scrollTo({ offset: width, animated: true });
    } else {
      this._scrollTo({ offset: currentPage * width, animated: true });
    }
    this._setCurrentPage(currentPage);
    this._setUpTimer();
  };

  _placeCritical = (page) => {
    const {
      childrenLength,
      size: { width },
    } = this.state;
    if (childrenLength === 1) {
      this._scrollTo({ offset: 0, animated: false });
    } else if (this.props.isLooped && page === 0) {
      this._scrollTo({ offset: childrenLength * width, animated: false });
    } else {
      this._scrollTo({ offset: page * width, animated: false });
    }
  };

  _normalizePageNumber = (page) => {
    const { childrenLength } = this.state;
    if (page === childrenLength) {
      return 0;
    } else if (page > childrenLength) {
      return 1;
    } else if (page < 0) {
      return childrenLength - 1;
    }
    return page;
  };

  _calculateCurrentPage = (offset) => {
    const { width } = this.state.size;
    const page = Math.floor((offset + 1) / width);
    return this._normalizePageNumber(page);
  };

  _renderShowIndicator = (pageLength) => {
    const { progressAnimation, indicatorCircleHeight, indicatorCircleWidth } =
      this.props;
    const width = indicatorCircleWidth
      ? indicatorCircleWidth
      : indicatorCircleHeight * 12;
    return (
      <View
        style={[
          styles.indicatorBottomContainer,
          this.props.indicatorBottomContainerStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.indicatorContainer}>
          <View style={styles.bulletsContainer}>
            {this.props.children.map((_, index) => {
              return (
                <View
                  key={index}
                  style={{
                    overflow: 'hidden',
                    width: progressAnimation
                      ? width
                      : index === this.state.currentPage
                      ? indicatorCircleHeight * 3
                      : indicatorCircleHeight,
                    height: this.props.indicatorCircleHeight,
                    borderRadius: this.props.indicatorCircleHeight,
                    backgroundColor: progressAnimation
                      ? this.props.indicatorDefaultColor
                      : index === this.state.currentPage
                      ? this.props.indicatorActiveColor
                      : this.props.indicatorDefaultColor,
                    margin: 6,
                    opacity:
                      index !== this.state.currentPage
                        ? this.props.indicatorOpacity
                        : 1,
                  }}
                >
                  {progressAnimation && index === this.state.currentPage ? (
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: -width,
                        borderRadius: this.props.indicatorCircleHeight,
                        height: this.props.indicatorCircleHeight,
                        backgroundColor: this.props.indicatorActiveColor,
                        width: width,
                        transform: [{ translateX: this.progress }],
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  _renderBullets = (pageLength) => {
    const bullets = [];
    for (let i = 0; i < pageLength; i += 1) {
      bullets.push(
        <TouchableWithoutFeedback
          onPress={() => this.animateToPage(i)}
          key={`bullet${i}`}
        >
          <View
            style={
              i === this.state.currentPage
                ? [styles.chosenBullet, this.props.chosenBulletStyle]
                : [styles.bullet, this.props.bulletStyle]
            }
          />
        </TouchableWithoutFeedback>
      );
    }
    return (
      <View style={styles.bullets} pointerEvents="box-none">
        <View
          style={[styles.bulletsContainer, this.props.bulletsContainerStyle]}
          pointerEvents="box-none"
        >
          {bullets}
        </View>
      </View>
    );
  };

  _renderArrows = () => {
    let { currentPage } = this.state;
    const { childrenLength } = this.state;
    if (currentPage < 1) {
      currentPage = childrenLength;
    }
    return (
      <View style={styles.arrows} pointerEvents="box-none">
        <View
          style={[styles.arrowsContainer, this.props.arrowsContainerStyle]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={this._animatePreviousPage}
            style={this.props.arrowStyle}
          >
            <Text style={this.props.leftArrowStyle}>
              {this.props.leftArrowText ? this.props.leftArrowText : 'Left'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={this._animateNextPage}
            style={this.props.arrowStyle}
          >
            <Text style={this.props.rightArrowStyle}>
              {this.props.rightArrowText ? this.props.rightArrowText : 'Right'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  render() {
    const { contents } = this.state;

    const containerProps = {
      onLayout: this._onLayout,
      style: [this.props.style || styles.container],
    };

    const { size } = this.state;
    const childrenLength = React.Children.count(this.props.children);
    return (
      <View {...containerProps}>
        <Animated.ScrollView
          ref={(c) => {
            this.scrollView = c;
          }}
          onScroll={this.props.onScroll}
          onScrollBeginDrag={this._onScrollBegin}
          onMomentumScrollEnd={this._onScrollEnd}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          contentInset={{ top: 0 }}
          automaticallyAdjustContentInsets={false}
          showsHorizontalScrollIndicator={false}
          horizontal
          pagingEnabled
          bounces={false}
          scrollEnabled={this.props.swipe}
          contentContainerStyle={[
            styles.horizontalScroll,
            this.props.contentContainerStyle,
            {
              width:
                size.width *
                (childrenLength +
                  (childrenLength > 1 && this.props.isLooped ? 2 : 0)),
              height: size.height,
            },
          ]}
        >
          {contents}
        </Animated.ScrollView>
        {this.props.arrows && this._renderArrows(this.state.childrenLength)}
        {this.props.bullets && this._renderBullets(this.state.childrenLength)}
        {this.props.showIndicator &&
          this._renderShowIndicator(this.state.childrenLength)}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: 200,
  },
  horizontalScroll: {
    position: 'absolute',
  },
  indicatorBottomContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  indicatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bullets: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    height: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  arrows: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'transparent',
  },
  arrowsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulletsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  chosenBullet: {
    margin: 10,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  bullet: {
    margin: 10,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderColor: 'white',
    borderWidth: 1,
  },
  flexDirection: {
    flexDirection: 'row',
  },
});
