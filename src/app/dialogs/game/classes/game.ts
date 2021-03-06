import { Map } from './map';
import { Pac } from './pac';
import { User } from './user';
import { Ghost } from './ghost';
import { Helper } from './helper';
import { DIRECTIONS } from './enums';

export class Game {
    public blockSize = 26;
    public moveRate = 5;
    public timeToRerender = 30;

    public enableTouchControlToDesktop: boolean = false;

    public state: GAME_STATE;

    public colors = {
        background: COLOR.DARK,
        pac: COLOR.GOLD,
        wall: COLOR.BLUE,
        biscuit: COLOR.GOLD
    };

    public map: Map;
    public pac: Pac;
    public user: User;
    
    public ghosts: Ghost[];

    public width: number;
    public height: number;

    public from: HTMLElement;
    public close: () => void;
	
    public coinImg = new Image();
	
    public get isRunning() { return this.state === GAME_STATE.RUNNING; }
    public get canvas(): HTMLCanvasElement { return this.from?.querySelector('canvas'); }
    public get context(): CanvasRenderingContext2D { return this.canvas.getContext('2d'); }

    private loop: any;
    private isStarted: boolean = false;
    
    constructor() {
        this.coinImg.src = 'assets/img/game/baby-bottle.png';
        this.state = GAME_STATE.STOPPED;
    }

    public start(options: { restarting?: boolean, from?: HTMLElement, close?: () => void }) {
		this.from = options?.from || this.from || document.body;
		this.close = options?.close || this.close;

        this.map = new Map(this);
        this.pac = new Pac(this);
        this.user = new User(this);

        this.ghosts = [
            new  Ghost(this, '01'),
            new  Ghost(this, '02'),
            new  Ghost(this, '03'),
            new  Ghost(this, '04'),
        ];

        this.width = this.map.lengthX * this.blockSize;
        this.height = this.map.lengthY * this.blockSize;

        if (!this.isStarted) {
            this.createCanvas();
        }

        if (!(options?.restarting)) {
            this.user.showStartGameWindow();
            this.state = GAME_STATE.STOPPED;
        }
        else {
			setTimeout(() => this.state = GAME_STATE.RUNNING, 500);
		}

		this.startListeners();
        this.runGameLoop();
        this.loop = setInterval(this.runGameLoop.bind(this), this.timeToRerender);

        this.isStarted = true;
    }

    public restart() {
		this.stop();
        this.closeAllOpenedWindows();
        this.start({ restarting: true });
    }

    public resume(withRestart: boolean = false) {
        if (withRestart)
            this.restart();
        else {
            this.closeAllOpenedWindows();
            setTimeout(() => this.state = GAME_STATE.RUNNING, 500);
        }
    }

    public stop() {
        clearInterval(this.loop);
        this.state = GAME_STATE.STOPPED;
		this.stopListeners();
    }

    private createCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.backgroundColor = this.colors.background;
        this.from.style.backgroundColor = this.colors.background;

        this.defineSizeVarsStyle();
        this.createMobileControl();
    }

    private defineSizeVarsStyle() {
        document.documentElement.style.setProperty('--canvas-width', this.width + 'px');
        document.documentElement.style.setProperty('--canvas-height', this.height + 'px');

        document.documentElement.style.setProperty('--window-width', (this.width - 100) + 'px');

        document.documentElement.style.setProperty('--game-dark', COLOR.DARK);
        document.documentElement.style.setProperty('--game-blue', COLOR.BLUE);
        document.documentElement.style.setProperty('--game-gold', COLOR.GOLD);
    }

    private createMobileControl() {
        if (!this.enableTouchControlToDesktop && !Helper.isMobileDevice())
            return;

        let controlHtml = `
        <div class="mobile-control">
            <div id="mobile-control-move"></div>
        </div>`;
        this.canvas.insertAdjacentHTML('afterend', controlHtml);

        let moveEl = document.getElementById('mobile-control-move');

        let initX = moveEl.getBoundingClientRect().left;
        let initY = moveEl.getBoundingClientRect().top;
        let direction = DIRECTIONS.NONE;

        let minDistanceToStart = 10;
        let maxDistance = 150;
        let toucheState = 'NONE';
        let intervalTouching: any = null;

        let onStart = (_event: TouchEvent | KeyboardEvent) => {
            let event: any = (_event instanceof TouchEvent) ? (_event as TouchEvent).touches[0] : _event;

            if (toucheState === 'NONE') {
                initX = event.pageX;
                initY = event.pageY;

                toucheState = 'START';
                moveEl.style.transition = '';

                intervalTouching = setInterval(() => {
                    if (direction !== DIRECTIONS.NONE)
                        this.pac.onKeydown({ keyCode: this.pac.getCodeByDirection(direction) });    
                }, this.timeToRerender);
            }
            else {
                _event.cancelBubble = true;
                _event.preventDefault();
                return false;
            }
        }

        let onMove = (_event: TouchEvent | KeyboardEvent) => {
            let event: any = (_event instanceof TouchEvent) ? (_event as TouchEvent).touches[0] : _event;

            if (toucheState === 'START' || toucheState === 'MOVING') {
                toucheState = 'MOVING';
                let nextDirection = DIRECTIONS.NONE;

                let directionX = DIRECTIONS.NONE;
                let directionY = DIRECTIONS.NONE;
                let diffX = 0;
                let diffY = 0;
                let x = event.pageX;
                let y = event.pageY;

                // IN X
                if (x > initX) {
                    diffX = Math.min(x - initX, maxDistance);
                    moveEl.style.left = `calc(50% + ${diffX}px)`;

                    if (diffX >= minDistanceToStart)
                        directionX = DIRECTIONS.RIGHT;
                }
                else {
                    diffX = Math.min(initX - x, maxDistance);
                    moveEl.style.left = `calc(50% - ${diffX}px)`;

                    if (diffX >= minDistanceToStart)
                        directionX = DIRECTIONS.LEFT;
                }

                // IN Y
                if (y > initY) {
                    diffY = Math.min(y - initY, maxDistance);
                    moveEl.style.top = `calc(50% + ${diffY}px)`;

                    if (diffY >= minDistanceToStart)
                        directionY = DIRECTIONS.DOWN;
                }
                else {
                    diffY = Math.min(initY - y, maxDistance);
                    moveEl.style.top = `calc(50% - ${diffY}px)`;

                    if (diffY >= minDistanceToStart)
                        directionY = DIRECTIONS.UP;
                }

                // DEFINE DIRECTIO
                if (diffX >= minDistanceToStart || diffY >= minDistanceToStart) {
                    if (diffX > diffY)
                        nextDirection = directionX;
                    else
                        nextDirection = directionY;
                }
                else
                    nextDirection = DIRECTIONS.NONE;

                direction = nextDirection;
            }
            _event.preventDefault();
            return false;
        }

        let onEnd = () => {
            toucheState = 'NONE';
            moveEl.style.transition = 'all .2s';
            moveEl.style.left = '50%';
            moveEl.style.top = '50%';
        }

        if (Helper.isMobileDevice()) {
            this.from.ontouchstart = onStart.bind(this);
            this.from.ontouchmove = onMove.bind(this);
            this.from.ontouchend = onEnd.bind(this);
        } 
        else if (this.enableTouchControlToDesktop) {
            this.from.onmousedown = onStart.bind(this);
            this.from.onmousemove = onMove.bind(this);
            this.from.onmouseup = onEnd.bind(this);
        }
    }

    private startListeners () {
		document.addEventListener('keydown', this.onKeyDown.bind(this))
    }
    private stopListeners () {
        document.removeEventListener('keydown', this.onKeyDown.bind(this))
    }

	// Listeners
	private onKeyDown(event: KeyboardEvent) {
		this.pac.onKeydown(event);
	}

    private runGameLoop() {
        this.context.beginPath();
        this.context.clearRect(0, 0, this.width, this.height);
        this.map.render();
        this.pac.render();
        this.ghosts.forEach(function(ghost) {
            ghost.render();
        });
    };

    public ghostFoundPac(ghost: Ghost) {
        this.state = GAME_STATE.GHOST_FOUND_PAC;
        this.showLooseWindow();
    }

    public showLooseWindow() { this.user.showLooseWindow(); }
    public closeLooseWindow() { this.user.closeLooseWindow(); }

    public showHowToPlayWindow() { this.user.showHowToPlayWindow(); }
    public closeHowToPlayWindow() { this.user.closeHowToPlayWindow(); }

    public closeAllOpenedWindows() {
        this.user.closeAllOpenedWindows();
    }

    public pacFoundStunnedGhost(ghost: Ghost) {
        ghost.goToHomeBecauseDead();
    }

    public onPacGettedPill() {
        this.ghosts.forEach((ghost) => {
            ghost.onPillGetted();
        });
    }

    public applySmoothCoord (fromPosition: number, toPosition: number, customRate?: number) {
        let rate = customRate ? customRate : 2.5;
        if (fromPosition !== toPosition) {
            let newPosition = fromPosition + ((fromPosition < toPosition) ? rate : -rate);
            if (fromPosition < toPosition && newPosition > toPosition)
                return toPosition;
            else if (fromPosition > toPosition && newPosition < toPosition)
                return toPosition;
            return newPosition;
        }
        return fromPosition;
    }

    public isSocialBank() {
        return Helper.getUrlParams().sb === 'true';
    }
}

export enum GAME_STATE {
    STOPPED = 'STOPPED',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    GHOST_FOUND_PAC = 'GHOST_FOUND_PAC',
    WIN = 'WIN',
    GAME_OVER = 'GAME_OVER'
}

export enum COLOR {
    TRANSPARENT = 'transparent',
    DARK = '#333333',
    GOLD = '#FACD00',
    BLUE = '#48D3FF',
}