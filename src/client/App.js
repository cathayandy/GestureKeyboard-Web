import React, { useEffect, useRef } from 'react';
import './app.css';
import ReactImage from './react.png';
import Keyboard from './components/Keyboard/keyboard';
import Grid from './components/Grid/grid';
import io from 'socket.io-client';

const App = () => {
  const keyboardRef = useRef();
  useEffect(() => {
    // const socket = io();
    // socket.on('connect', () => {
    //     console.log('connected!!');
    //   });
    // socket.on('data', function(data) {
    //   // console.log('receive:');
    //   // console.log(data);
    //   let lines = data.split('\n');
    //   lines.forEach(element => {
    //     let items = element.split(' ');
    //     updateEvent(parseInt(items[0]), {x: parseFloat(items[1]), y: parseFloat(items[2])}, true);        
    //   });

    // });
  });

  let updateEvent = (type, pos, normalized) => {
    keyboardRef.current.onEvent(type, pos, normalized);
  }
  return (
  <div>
    <Keyboard cRef={keyboardRef}/>
    <Grid />
  </div>)
}
export default App;
// export default class App extends Component {
//   state = { username: null };

//   componentDidMount() {
//     fetch('/api/getUsername')
//       .then(res => res.json())
//       .then(user => this.setState({ username: user.username }));
//   }

//   render() {
//     const { username } = this.state;
//     return (
//       <div>
//         {/* {username ? <h1>{`Hello ${username}`}</h1> : <h1>Loading.. please wait!</h1>}
//         <img src={ReactImage} alt="react" /> */}
//         <Keyboard />
//       </div>
//     );
//   }
// }
