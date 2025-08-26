# lightsabers

- mobile-optimized web-app for playing with lisp
- optimized for easy deployment
- built leveraging lLms

## why "lightsabers"

> "There are your father's parentheses. Elegant weapons for a more... civilized age." -- [[https://xkcd.com/297/]]

# [generated docs Mobile Lisp REPL PWA

A mobile-optimized Progressive Web App for interactive Lisp programming, featuring auto-formatting, syntax highlighting, and a custom virtual keyboard designed for Lisp development.

## Features

### Core Functionality
- **Multi-language support**: BiwaScheme (Scheme) and Fennel 
- **Real-time auto-formatting**: Code is automatically indented and formatted as you type
- **Syntax highlighting**: Keywords, strings, numbers, and parentheses are color-coded
- **Smart autocomplete**: Suggests functions, variables, and keywords based on context
- **Voice input**: Use speech recognition to input code (on supported browsers)

### Mobile-Optimized Interface
- **Custom virtual keyboard**: Large parentheses keys, special Lisp symbols
- **Touch-friendly**: All buttons sized for finger interaction
- **Responsive design**: Works on phones, tablets, and desktop
- **Dark theme**: Easy on the eyes for coding sessions

### Developer Features
- **Command history**: Navigate through previous expressions with swipe or arrow keys
- **Variable tracking**: Quick access to defined variables and functions
- **Export/Import**: Save and restore your coding session
- **Offline capable**: Works without internet connection after first load

## Supported Languages

### BiwaScheme (Scheme)
Complete Scheme implementation with support for:
- Core functions: `define`, `lambda`, `let`, `if`, `cond`
- List operations: `car`, `cdr`, `cons`, `map`, `filter`
- Arithmetic: `+`, `-`, `*`, `/`, comparison operators
- I/O functions: `display`, `write`

### Fennel
Lisp syntax that compiles to Lua:
- Functions: `fn`, `lambda`, `let`, `local`
- Control flow: `if`, `when`, `cond`, `case`
- Iteration: `each`, `for`, `while`
- Table operations and Lua interop

## Architecture

### Modular Language Engine
The app uses a plugin-based architecture where each language implements the `LanguageEngine` interface:

```javascript
class LanguageEngine {
  async evaluate(code)     // Execute code and return result
  format(code)             // Auto-format with proper indentation
  getCompletions(partial)  // Provide autocomplete suggestions
  getKeywords()            // Return syntax highlighting keywords
  getSpecialKeys()         // Define custom keyboard layout
  reset()                  // Reset REPL state
}
```

### Key Components
- **Auto-formatter**: Real-time parentheses-aware indentation
- **Syntax highlighter**: Language-specific token recognition
- **Virtual keyboard**: Touch-optimized input for Lisp symbols
- **Storage manager**: Local persistence for history and variables
- **Service worker**: Offline functionality and PWA features

## Installation & Deployment

### Option 1: Static File Deployment
The app is entirely self-contained in a single HTML file.

1. **Download the HTML file**:
   ```bash
   # Save the artifact as index.html
   curl -o index.html [your-html-file-url]
   ```

2. **Deploy to any static hosting**:
   ```bash
   # GitHub Pages
   git add index.html
   git commit -m "Add Lisp REPL"
   git push origin gh-pages
   
   # Netlify
   netlify deploy --prod --dir .
   
   # Vercel
   vercel --prod
   
   # AWS S3
   aws s3 cp index.html s3://your-bucket/ --acl public-read
   ```

3. **Local development**:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```

### Option 2: Deploy to Popular Platforms

#### Netlify
1. Create a new site on [netlify.com](https://netlify.com)
2. Drag and drop the HTML file
3. Your app is live instantly with HTTPS and PWA support

#### GitHub Pages
1. Create a new repository
2. Upload the HTML file as `index.html`
3. Enable GitHub Pages in repository settings
4. Access at `https://username.github.io/repository-name`

#### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the directory with your HTML file
3. Follow the prompts for instant deployment

#### Firebase Hosting
```bash
npm install -g firebase-tools
firebase init hosting
# Place HTML file in public directory
firebase deploy
```

### Option 3: Docker Deployment
```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80
```

```bash
docker build -t lisp-repl .
docker run -p 8080:80 lisp-repl
```

## Usage

### Getting Started
1. Open the app in your mobile browser
2. Select a language (Scheme or Fennel) from the dropdown
3. Start typing Lisp expressions
4. Use the virtual keyboard for special symbols
5. Press ENTER or tap the ENTER key to evaluate

### Keyboard Shortcuts
- **Enter**: Evaluate expression
- **Shift+Enter**: New line without evaluating
- **↑/↓ arrows**: Navigate command history
- **Tab**: Auto-complete with first suggestion
- **Escape**: Close autocomplete popup

### Touch Gestures
- **Swipe left/right** on input: Navigate history
- **Tap variable tags**: Insert variable name
- **Long press keys**: Repeat key input

### Voice Input
- Tap the microphone button (🎤)
- Speak your code naturally
- Works best with clear pronunciation of parentheses as "open paren" and "close paren"

## Customization

### Adding New Languages
1. Create a new class extending `LanguageEngine`
2. Implement the required methods
3. Add to the `engines` object in `MobileLispREPL`
4. Update the language selector

Example:
```javascript
class ClojureScriptEngine extends LanguageEngine {
  async evaluate(code) {
    // Your ClojureScript evaluation logic
  }
  
  getKeywords() {
    return ['defn', 'let', 'if', 'loop', 'recur'];
  }
}
```

### Customizing the Keyboard
Modify the `getSpecialKeys()` method in any language engine:
```javascript
getSpecialKeys() {
  return [
    ['(', ')', 'your-symbol', "'"],
    ['custom-key1', 'custom-key2'],
    // ... more rows
  ];
}
```

### Styling
All CSS is embedded and easily customizable. Key classes:
- `.key.paren`: Parentheses buttons
- `.code-display .keyword`: Syntax highlighting colors
- `.keyboard-area`: Virtual keyboard container
- `.output-area`: REPL output styling

## Browser Compatibility

### Fully Supported
- **iOS Safari** 12+
- **Chrome Mobile** 80+
- **Firefox Mobile** 68+
- **Samsung Internet** 10+

### Features by Browser
- **Speech Recognition**: Chrome, Edge, Safari (partial)
- **PWA Install**: All modern browsers
- **Service Workers**: All except IE
- **Local Storage**: Universal support

## Performance

### Optimization Features
- **Lazy loading**: Languages loaded only when selected
- **Memory management**: History limited to 100 entries
- **Efficient rendering**: Virtual scrolling for large outputs
- **Caching**: Service worker caches all resources

### Memory Usage
- **Base app**: ~2MB (including language engines)
- **History storage**: ~10KB per 100 entries
- **Variables storage**: ~1KB per language

## Troubleshooting

### Common Issues

**App won't load:**
- Check browser console for errors
- Ensure CDN resources are accessible
- Try clearing browser cache

**Voice input not working:**
- Check microphone permissions
- Only works on HTTPS (or localhost)
- Not supported in all browsers

**Keyboard not responsive:**
- Disable browser zoom
- Check for JavaScript errors
- Try refreshing the page

**Autocomplete not showing:**
- Type at least 1 character
- Check if popup is hidden behind keyboard
- Verify JavaScript is enabled

### Debug Mode
Add `?debug=true` to URL for additional logging:
```javascript
// Enable debug mode
if (new URLSearchParams(location.search).get('debug')) {
  console.debug('Debug mode enabled');
}
```

## Contributing

### Development Setup
1. Clone or download the HTML file
2. Serve locally with any web server
3. Open browser developer tools
4. Make changes and test immediately

### Code Structure
- **HTML**: App structure and PWA manifest
- **CSS**: All styles embedded in `<style>` tag
- **JavaScript**: Modular engine architecture

### Adding Features
1. Language engines are in the `LanguageEngine` class hierarchy
2. UI components are methods of `MobileLispREPL`
3. All state is managed through localStorage
4. PWA features handled by inline service worker

## License

This project is open source. Feel free to modify and distribute.

## Credits

- **BiwaScheme**: Scheme interpreter by Yutaka Hara
- **Fennel**: Lua-targeting Lisp by Calvin Rose
- **Design**: Inspired by classic REPL interfaces
- **Icons**: Using system emoji and Unicode symbols
