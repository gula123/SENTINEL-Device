import { render } from "@testing-library/react-native";
import RootNavigator from "./RootNavigator";

const authState = {
  isHydrating: false,
  isAuthenticated: false,
};

jest.mock("../state/AuthContext", () => ({
  useAuth: () => authState,
}));

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }: any) => <>{children}</>,
}));

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ name, component: Component }: any) => {
      const { Text: MockText } = require("react-native");
      return (
      <>
        <MockText>{name}</MockText>
        <Component />
      </>
      );
    },
  }),
}));

jest.mock("../screens/auth/LoginScreen", () => () => {
  const { Text: MockText } = require("react-native");
  return <MockText>LoginScreen</MockText>;
});
jest.mock("./MainStack", () => () => {
  const { Text: MockText } = require("react-native");
  return <MockText>MainStack</MockText>;
});

describe("RootNavigator", () => {
  it("shows hydration loader while auth state is restoring", () => {
    authState.isHydrating = true;
    authState.isAuthenticated = false;
    const { queryByText } = render(<RootNavigator />);

    expect(queryByText("LoginScreen")).toBeNull();
    expect(queryByText("MainStack")).toBeNull();
  });

  it("routes unauthenticated users to login", () => {
    authState.isHydrating = false;
    authState.isAuthenticated = false;
    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText("Login")).toBeTruthy();
    expect(getByText("LoginScreen")).toBeTruthy();
    expect(queryByText("MainStack")).toBeNull();
  });

  it("routes authenticated users to main stack", () => {
    authState.isHydrating = false;
    authState.isAuthenticated = true;
    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText("Main")).toBeTruthy();
    expect(getByText("MainStack")).toBeTruthy();
    expect(queryByText("LoginScreen")).toBeNull();
  });
});
